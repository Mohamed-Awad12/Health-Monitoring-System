/**
 * ================================================================
 *  HEALTH MONITOR FIRMWARE v4.3.2 — SIMPLIFIED UI EDITION
 *  Hardware : NodeMCU V3 (ESP8266) + MAX30102 + OLED 128x32 I2C
 *            + Passive Buzzer on D7
 *            + Battery voltage divider on A0 (200kΩ / 100kΩ)
 *
 *  Changes from v4.3.1 → v4.3.2:
 *
 *  [UX-SIM] Simplified OLED layouts across all five screens:
 *
 *    WAITING  — Removed scrolling ECG trace and horizontal divider.
 *               Kept animated pulse rings + "Place finger" text.
 *               WiFi icon and battery % retained in header row.
 *
 *    WARMUP   — Replaced dual sweep arcs (BPM + SpO2) with a
 *               single bottom segment bar. Shows "Calibrating…"
 *               with blinking dot. Dashed divider removed.
 *
 *    READING  — Removed redundant SpO2 arc from header (value
 *               shown in gauge already). Removed sparkline graph;
 *               kept signal bars. Removed BPM/SpO2 sub-labels.
 *               Trend arrow retained. Layout is now two large
 *               numbers with a clean centre divider.
 *
 *    ALERT    — Removed escalation countdown bar and unit labels.
 *               Alert type (HR / SpO2) shown in blinking header.
 *               Hint text and large values retained.
 *
 *    SUMMARY  — Removed dashed centre divider and "HR"/"SpO2"
 *               sub-labels above values. Quality hearts retained.
 *               Drain bar retained.
 *
 *    PORTAL   — No changes (already minimal).
 *
 *  Retained from v4.3.1:
 *  [UX-25] QR Code portal screen
 *  [UX-1..24] All previous logic (no functional changes)
 *  [NEW-1..6]  Dynamic WiFi / captive portal / EEPROM cred storage
 * ================================================================
 */

#include <math.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <ESP8266WiFi.h>
#include <ESP8266WebServer.h>
#include <DNSServer.h>
#include <EEPROM.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClient.h>
#include <ArduinoJson.h>
#include "MAX30105.h"
#include "spo2_algorithm.h"
#include "heartRate.h"
#include <WiFiClientSecure.h>

// ================================================================
//  WiFi PORTAL CONFIGURATION
// ================================================================
#define PORTAL_SSID      "HealthMonitor-Setup"
#define PORTAL_PASSWORD  ""
#define PORTAL_IP        IPAddress(192, 168, 4, 1)
#define DNS_PORT         53
#define HTTP_PORT        80
#define PORTAL_TIMEOUT   180000UL

#define EE_SSID_ADDR      0
#define EE_PASS_ADDR     32
#define EE_MAGIC_ADDR    96
#define EE_MAGIC_VAL   0xAB
#define EE_SIZE         128

#define RESET_CREDS_PIN   0

DNSServer        dnsServer;
ESP8266WebServer portalServer(HTTP_PORT);
bool             portalActive = false;

// ================================================================
//  BACKEND CONFIGURATION
// ================================================================
const char* SERVER_URL    = "https://backend-production-b94e.up.railway.app/api/device/data";
const char* DEVICE_SECRET = "HM-02";
uint32_t    lastDataSentAt = 0;
const uint32_t SEND_INTERVAL = 4000;

// ================================================================
//  OLED
// ================================================================
#define SCREEN_WIDTH   128
#define SCREEN_HEIGHT   32
#define OLED_RESET      -1
#define OLED_ADDR     0x3C

Adafruit_SSD1306 oled(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);
MAX30105         sensor;

// ================================================================
//  BUZZER — D7 = GPIO13
// ================================================================
#define BUZZER_PIN  13

struct BuzzStep { uint16_t freq; uint16_t durMs; };

static const BuzzStep SEQ_BEAT[]    = { {1200, 25}, {0, 0} };
static const BuzzStep SEQ_READY[]   = { {800, 80}, {0, 55}, {1400, 140}, {0, 0} };
static const BuzzStep SEQ_ALERT[]   = { {2200, 80}, {0, 50}, {2200, 80}, {0, 50}, {2200, 80}, {0, 0} };
static const BuzzStep SEQ_SUMMARY[] = { {1000, 60}, {0, 40}, {1200, 60}, {0, 0} };

const BuzzStep* buzzSeq    = nullptr;
uint8_t         buzzStep   = 0;
uint32_t        buzzStepAt = 0;
bool            buzzActive = false;

void buzzPlay(const BuzzStep* seq) {
  noTone(BUZZER_PIN);
  buzzSeq = seq; buzzStep = 0; buzzStepAt = millis(); buzzActive = true;
  if (seq[0].freq > 0) tone(BUZZER_PIN, seq[0].freq);
}

void buzzUpdate() {
  if (!buzzActive || buzzSeq == nullptr) return;
  if (millis() - buzzStepAt < buzzSeq[buzzStep].durMs) return;
  buzzStep++;
  if (buzzSeq[buzzStep].durMs == 0) { noTone(BUZZER_PIN); buzzActive = false; return; }
  buzzStepAt = millis();
  if (buzzSeq[buzzStep].freq > 0) tone(BUZZER_PIN, buzzSeq[buzzStep].freq);
  else noTone(BUZZER_PIN);
}

// ================================================================
//  BATTERY MONITORING
// ================================================================
#define BAT_PIN             A0
#define BAT_DIVIDER_RATIO   3.676f
#define BAT_ADC_VREF        3.3f
#define BAT_ADC_MAX         1023.0f
#define BAT_FULL_V          4.2f
#define BAT_EMPTY_V         3.0f
#define BAT_READ_INTERVAL   10000UL

int      batPct    = -1;
uint32_t batReadAt = 0;

// ================================================================
//  THRESHOLDS & TUNING
// ================================================================
#define HR_HIGH_BPM          120
#define HR_LOW_BPM            50
#define SPO2_LOW_PCT          94
uint32_t FINGER_THRESHOLD = 50000UL;
#define SPO2_BUFFER_SIZE     100
#define SPO2_WARMUP_CYCLES     3
#define SAMPLE_RATE          100.0f
#define BPM_ALPHA            0.22f
#define RATE_SIZE              8
#define FINGER_DEBOUNCE        8
#define MIN_BEAT_INTERVAL_MS 400
#define BPM_GATE_SAMPLES      80

// Summary hold duration
#define SUMMARY_HOLD_MS      5000UL

// BPM trend
int8_t   trendDir = 0;  // -1 down, 0 flat, +1 up

// Trend tracking (replaces sparkline)
#define BPM_TREND_SIZE       8
#define BPM_TREND_INTERVAL   2000UL
int      bpmTrend[BPM_TREND_SIZE];
uint8_t  trendHead  = 0;
uint8_t  trendCount = 0;
uint32_t trendAt    = 0;

// Session quality
static const char* sessionQuality = "";

// ── 1-bit bitmaps ─────────────────────────────────────────────

// Heart (5×5) — quality stars in summary
static const uint8_t HEART5_BMP[] PROGMEM = {
  0x0A, 0x1F, 0x1F, 0x0E, 0x04
};
#define HEART5_W 5
#define HEART5_H 5

// Heart (8×6) — reading/warmup header
static const uint8_t HEART_BMP[] PROGMEM = {
  0x66, 0xFF, 0xFF, 0x7E, 0x3C, 0x18
};
#define HEART_W 8
#define HEART_H 6

// Arrow UP (5×5)
static const uint8_t ARROW_UP_BMP[] PROGMEM = {
  0x04, 0x0E, 0x1F, 0x04, 0x04
};
// Arrow DOWN (5×5)
static const uint8_t ARROW_DOWN_BMP[] PROGMEM = {
  0x04, 0x04, 0x1F, 0x0E, 0x04
};
#define ARROW_W 5
#define ARROW_H 5

// ── [UX-25] QR code for "http://192.168.4.1" ──────────────────
#define QR_SIZE      27
#define QR_ROW_BYTES  4

static const uint8_t QR_BITMAP[QR_SIZE * QR_ROW_BYTES] PROGMEM = {
  0x00, 0x00, 0x00, 0x00,
  0x7F, 0x3A, 0x5F, 0xC0,
  0x41, 0x0C, 0x10, 0x40,
  0x5D, 0x39, 0x57, 0x40,
  0x5D, 0x59, 0xD7, 0x40,
  0x5D, 0x56, 0x17, 0x40,
  0x41, 0x33, 0x10, 0x40,
  0x7F, 0x55, 0x5F, 0xC0,
  0x00, 0x26, 0x40, 0x00,
  0x63, 0xB5, 0xC6, 0x00,
  0x10, 0xD1, 0xE7, 0x80,
  0x23, 0x6C, 0x9A, 0xC0,
  0x34, 0x59, 0xC6, 0x40,
  0x73, 0x33, 0x70, 0x40,
  0x50, 0x17, 0x80, 0x80,
  0x4F, 0x33, 0xAA, 0xC0,
  0x4E, 0xC7, 0x45, 0x40,
  0x57, 0x95, 0x7D, 0x00,
  0x00, 0x70, 0xC5, 0x00,
  0x7F, 0x77, 0x56, 0x40,
  0x41, 0x79, 0x44, 0x00,
  0x5D, 0x28, 0xFF, 0x40,
  0x5D, 0x16, 0x1A, 0xC0,
  0x5D, 0x13, 0x21, 0x40,
  0x41, 0x56, 0xDC, 0x40,
  0x7F, 0x4E, 0xD2, 0x40,
  0x00, 0x00, 0x00, 0x00,
};

// ================================================================
//  STATE MACHINE
// ================================================================
enum SysState {
  STATE_WAITING,
  STATE_WARMUP,
  STATE_READING,
  STATE_ALERT,
  STATE_SUMMARY
};
SysState sysState = STATE_WAITING;

// Summary state data
int      summaryBPM  = 0;
int      summarySpo2 = 0;
uint32_t summaryAt   = 0;

// IR amplitude for signal bars
long     lastIrVal = 0;

byte     rateSamples[RATE_SIZE];
byte     rateIdx = 0, rateFilled = 0;
int      avgBPM = 0;
float    smoothBPM = 0.0f;
int      prevBPM = 0;
bool     bpmInited = false;
uint32_t sampleIdx = 0, lastBeatSmp = 0, lastBeatMs = 0;

uint32_t irBuf[SPO2_BUFFER_SIZE], redBuf[SPO2_BUFFER_SIZE];
int32_t  spo2Val = 0;
int8_t   spo2Valid = 0, hrAlgoValid = 0;
int32_t  hrAlgo = 0;
uint16_t spoBufIdx = 0;
int      spoCycles = 0;

int  spoHistory[5];
byte spoHistIdx = 0, spoHistCount = 0;

uint8_t     noFingerCount = 0;
bool        hrAlert = false, spo2Alert = false, needSleep = false;
const char* hrMsg   = "";
const char* spo2Msg = "";
const char* hrHint   = "";
const char* spo2Hint = "";
uint32_t    lastAlertBuzzAt = 0;

// ================================================================
//  EEPROM HELPERS
// ================================================================
void eepromReadStr(int addr, char* buf, int maxLen) {
  for (int i = 0; i < maxLen - 1; i++) {
    buf[i] = EEPROM.read(addr + i);
    if (buf[i] == '\0') break;
  }
  buf[maxLen - 1] = '\0';
}

void eepromWriteStr(int addr, const char* str, int maxLen) {
  for (int i = 0; i < maxLen; i++) {
    EEPROM.write(addr + i, (i < (int)strlen(str)) ? str[i] : 0);
  }
}

bool eepromHasCredentials() {
  return EEPROM.read(EE_MAGIC_ADDR) == EE_MAGIC_VAL;
}

void eepromSaveCredentials(const char* ssid, const char* pass) {
  eepromWriteStr(EE_SSID_ADDR, ssid, 32);
  eepromWriteStr(EE_PASS_ADDR, pass, 64);
  EEPROM.write(EE_MAGIC_ADDR, EE_MAGIC_VAL);
  EEPROM.commit();
  Serial.println(F("[EEPROM] Credentials saved."));
}

void eepromClearCredentials() {
  EEPROM.write(EE_MAGIC_ADDR, 0x00);
  EEPROM.commit();
  Serial.println(F("[EEPROM] Credentials cleared."));
}

// ================================================================
//  CAPTIVE PORTAL HTML
// ================================================================
static const char PORTAL_HTML[] PROGMEM = R"rawhtml(
<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Health Monitor Setup</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',sans-serif;background:#0f172a;color:#e2e8f0;
       min-height:100vh;display:flex;align-items:center;justify-content:center;padding:16px}
  .card{background:#1e293b;border:1px solid #334155;border-radius:16px;
        padding:28px 24px;width:100%;max-width:380px;box-shadow:0 20px 60px rgba(0,0,0,0.5)}
  .logo{text-align:center;margin-bottom:24px}
  .logo svg{width:48px;height:48px;fill:#ef4444}
  h1{font-size:1.3rem;font-weight:700;color:#f1f5f9;text-align:center;margin-top:8px}
  p.sub{font-size:.82rem;color:#94a3b8;text-align:center;margin-top:4px;margin-bottom:24px}
  label{display:block;font-size:.8rem;font-weight:600;color:#94a3b8;
        text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px}
  input[type=text],input[type=password]{
    display:block;width:100%;padding:10px 14px;border-radius:8px;
    border:1px solid #475569;background:#0f172a;color:#f1f5f9;
    font-size:.95rem;outline:none;transition:border .2s}
  input:focus{border-color:#3b82f6}
  .field{margin-bottom:16px}
  button{width:100%;padding:12px;margin-top:8px;border:none;border-radius:8px;
         background:#3b82f6;color:#fff;font-size:1rem;font-weight:700;
         cursor:pointer;transition:background .2s}
  button:hover{background:#2563eb}
  .note{font-size:.75rem;color:#64748b;text-align:center;margin-top:16px}
</style></head><body>
<div class="card">
  <div class="logo">
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5
               2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09
               C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5
               c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
    </svg>
    <h1>Health Monitor</h1>
    <p class="sub">Connect to your home WiFi</p>
  </div>
  <form action="/save" method="POST">
    <div class="field">
      <label for="ssid">Network Name (SSID)</label>
      <input type="text" id="ssid" name="ssid" placeholder="Enter WiFi name" required autocomplete="off">
    </div>
    <div class="field">
      <label for="pass">Password</label>
      <input type="password" id="pass" name="pass" placeholder="Enter WiFi password" autocomplete="off">
    </div>
    <button type="submit">Save &amp; Connect</button>
  </form>
  <p class="note">Device will restart and connect automatically.</p>
</div>
</body></html>
)rawhtml";

static const char PORTAL_SAVED_HTML[] PROGMEM = R"rawhtml(
<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Saved!</title>
<style>
  body{font-family:'Segoe UI',sans-serif;background:#0f172a;color:#e2e8f0;
       min-height:100vh;display:flex;align-items:center;justify-content:center;padding:16px}
  .card{background:#1e293b;border:1px solid #22c55e;border-radius:16px;
        padding:32px 24px;text-align:center;max-width:340px;width:100%}
  .icon{font-size:3rem;margin-bottom:16px}
  h1{color:#22c55e;font-size:1.3rem;margin-bottom:8px}
  p{color:#94a3b8;font-size:.9rem}
</style></head><body>
<div class="card">
  <div class="icon">&#x2705;</div>
  <h1>Credentials Saved!</h1>
  <p>The device is restarting and will connect to your WiFi. You can close this page.</p>
</div></body></html>
)rawhtml";

// ================================================================
//  CAPTIVE PORTAL LOGIC
// ================================================================

// Draw QR code bitmap at pixel offset (ox, oy)
void drawQRCode(int ox, int oy) {
  for (int r = 0; r < QR_SIZE; r++) {
    for (int c = 0; c < QR_SIZE; c++) {
      uint8_t byteVal = pgm_read_byte(&QR_BITMAP[r * QR_ROW_BYTES + c / 8]);
      if (byteVal & (1 << (7 - (c % 8)))) {
        oled.drawPixel(ox + c, oy + r, SSD1306_WHITE);
      }
    }
  }
}

// Portal screen — QR left, info right (unchanged from v4.3.1)
void oledPortalScreen() {
  oled.clearDisplay();
  oled.setTextColor(SSD1306_WHITE);

  drawQRCode(0, 2);

  oled.drawLine(28, 0, 28, 31, SSD1306_WHITE);

  oled.fillRect(30, 0, 98, 9, SSD1306_WHITE);
  oled.setTextColor(SSD1306_BLACK);
  oled.setTextSize(1);
  oled.setCursor(32, 1);
  oled.print(F("Setup WiFi"));
  oled.setTextColor(SSD1306_WHITE);

  oled.setCursor(30, 11);
  oled.print(F("HlthMon-Setup"));

  oled.setCursor(30, 20);
  oled.print(F("192.168.4.1"));

  if (batPct >= 0) {
    drawBattery(109, 24);
    char pctBuf[5];
    snprintf(pctBuf, sizeof(pctBuf), "%d%%", batPct);
    int pw = strlen(pctBuf) * 6;
    oled.setCursor(109 - pw - 2, 25);
    oled.print(pctBuf);
  }

  oled.display();
}

void redirectToPortal() {
  portalServer.sendHeader("Location", "http://192.168.4.1/", true);
  portalServer.send(302, "text/plain", "");
}

void startPortal() {
  WiFi.disconnect(true);
  WiFi.mode(WIFI_AP);
  if (strlen(PORTAL_PASSWORD) > 0)
    WiFi.softAP(PORTAL_SSID, PORTAL_PASSWORD);
  else
    WiFi.softAP(PORTAL_SSID);
  WiFi.softAPConfig(PORTAL_IP, PORTAL_IP, IPAddress(255, 255, 255, 0));
  delay(500);

  dnsServer.setErrorReplyCode(DNSReplyCode::NoError);
  dnsServer.start(DNS_PORT, "*", PORTAL_IP);

  portalServer.on("/", HTTP_GET, []() {
    portalServer.send_P(200, "text/html", PORTAL_HTML);
  });
  portalServer.on("/save", HTTP_POST, []() {
    String ssid = portalServer.arg("ssid");
    String pass = portalServer.arg("pass");
    if (ssid.length() > 0 && ssid.length() < 32) {
      eepromSaveCredentials(ssid.c_str(), pass.c_str());
      portalServer.send_P(200, "text/html", PORTAL_SAVED_HTML);
      delay(2000); ESP.restart();
    } else {
      portalServer.send(400, "text/plain", "Invalid SSID");
    }
  });
  portalServer.on("/generate_204",                    HTTP_GET, redirectToPortal);
  portalServer.on("/gen_204",                         HTTP_GET, redirectToPortal);
  portalServer.on("/redirect",                        HTTP_GET, redirectToPortal);
  portalServer.on("/hotspot-detect.html", HTTP_GET, []() {
    portalServer.send(200, "text/html",
      "<HTML><HEAD><TITLE>Success</TITLE></HEAD><BODY>Success</BODY></HTML>");
  });
  portalServer.on("/library/test/success.html",       HTTP_GET, redirectToPortal);
  portalServer.on("/success.txt",                     HTTP_GET, redirectToPortal);
  portalServer.on("/ncsi.txt",                        HTTP_GET, redirectToPortal);
  portalServer.on("/connecttest.txt",                 HTTP_GET, redirectToPortal);
  portalServer.on("/msftconnecttest/connecttest.txt", HTTP_GET, redirectToPortal);
  portalServer.on("/msftncsi/ncsi.txt",               HTTP_GET, redirectToPortal);
  portalServer.onNotFound(redirectToPortal);
  portalServer.begin();
  portalActive = true;
  oledPortalScreen();
}

void runPortalLoop() {
  uint32_t startedAt = millis();
  while (true) {
    dnsServer.processNextRequest();
    portalServer.handleClient();
    static uint32_t lastRefresh = 0;
    if (millis() - lastRefresh > 1000) {
      lastRefresh = millis();
      oledPortalScreen();
    }
    if (millis() - startedAt > PORTAL_TIMEOUT) { ESP.restart(); }
    yield();
  }
}

// ================================================================
//  WiFi CONNECTION
// ================================================================
bool connectWiFi() {
  char savedSSID[32], savedPass[64];
  eepromReadStr(EE_SSID_ADDR, savedSSID, 32);
  eepromReadStr(EE_PASS_ADDR, savedPass, 64);

  oled.clearDisplay(); oled.setTextSize(1); oled.setTextColor(SSD1306_WHITE);
  oled.setCursor(8, 2);  oled.print(F("Connecting WiFi"));
  oled.setCursor(4, 16); oled.print(savedSSID);
  oled.display();

  WiFi.mode(WIFI_STA);
  WiFi.begin(savedSSID, savedPass);
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500); attempts++;
    oled.fillRect(0, 24, 128, 8, SSD1306_BLACK);
    oled.setCursor(4, 24);
    for (int d = 0; d < (attempts % 4); d++) oled.print('.');
    oled.display();
  }
  if (WiFi.status() == WL_CONNECTED) return true;
  return false;
}

// ================================================================
//  HTTP POST TO BACKEND
// ================================================================
void sendDataToBackend(int bpm, int spo2) {
  if (WiFi.status() != WL_CONNECTED) {
    oled.clearDisplay();
    oled.setTextSize(1); oled.setTextColor(SSD1306_WHITE);
    oled.setCursor(20, 4);  oled.print(F("WiFi lost..."));
    oled.setCursor(8,  18); oled.print(F("Data not sent"));
    oled.display(); delay(800); return;
  }
  WiFiClientSecure client; client.setInsecure();
  HTTPClient http;
  http.begin(client, SERVER_URL);
  http.addHeader("Content-Type", "application/json");
  StaticJsonDocument<200> doc;
  doc["deviceSecretId"] = DEVICE_SECRET;
  doc["bpm"]  = bpm;
  doc["spo2"] = spo2;
  String payload; serializeJson(doc, payload);
  int code = http.POST(payload);
  if (code > 0) { String r = http.getString(); Serial.printf("[WIFI] %s\n", r.c_str()); }
  http.end();
}

// ================================================================
//  BATTERY
// ================================================================
void updateBattery() {
  if (millis() - batReadAt < BAT_READ_INTERVAL && batPct != -1) return;
  batReadAt = millis();
  float raw  = (float)analogRead(BAT_PIN);
  float vA0  = (raw / BAT_ADC_MAX) * BAT_ADC_VREF;
  float vBat = vA0 * BAT_DIVIDER_RATIO;
  batPct = (int)(((vBat - BAT_EMPTY_V) / (BAT_FULL_V - BAT_EMPTY_V)) * 100.0f);
  batPct = constrain(batPct, 0, 100);
}

// ================================================================
//  SHARED DRAW HELPERS
// ================================================================

// Compact WiFi icon (12×10 area)
void drawWifiIcon(int x, int y, bool connected) {
  int cx = x + 6;
  int by = y + 8;
  if (connected) oled.fillCircle(cx, by, 1, SSD1306_WHITE);
  else           oled.drawPixel(cx, by, SSD1306_WHITE);
  if (connected) {
    oled.drawLine(cx - 2, by - 2, cx, by, SSD1306_WHITE);
    oled.drawLine(cx + 2, by - 2, cx, by, SSD1306_WHITE);
  } else {
    oled.drawPixel(cx - 2, by - 2, SSD1306_WHITE);
    oled.drawPixel(cx + 2, by - 2, SSD1306_WHITE);
  }
  if (connected) {
    oled.drawLine(cx - 4, by - 4, cx - 2, by - 2, SSD1306_WHITE);
    oled.drawLine(cx + 4, by - 4, cx + 2, by - 2, SSD1306_WHITE);
  } else {
    oled.drawPixel(cx - 4, by - 4, SSD1306_WHITE);
    oled.drawPixel(cx + 4, by - 4, SSD1306_WHITE);
  }
  oled.drawPixel(cx - 6, by - 6, SSD1306_WHITE);
  oled.drawPixel(cx + 6, by - 6, SSD1306_WHITE);
}

// Compact battery icon (12×6)
void drawBattery(int x, int y) {
  if (batPct < 0) return;
  oled.drawRect(x, y, 10, 6, SSD1306_WHITE);
  oled.fillRect(x + 10, y + 2, 2, 2, SSD1306_WHITE);
  int fillW = (int)(8.0f * batPct / 100.0f);
  if (fillW > 0) oled.fillRect(x + 1, y + 1, fillW, 4, SSD1306_WHITE);
}

// Signal quality bars (3 bars, 4px wide each)
void drawSignalBars(int x, int y, int level) {
  for (int i = 0; i < 3; i++) {
    int bh = (i + 1) * 3;
    int bx = x + i * 5;
    int by = y + (9 - bh);
    if (i < level) oled.fillRect(bx, by, 4, bh, SSD1306_WHITE);
    else           oled.drawRect(bx, by, 4, bh, SSD1306_WHITE);
  }
}

int irToSignalLevel(long ir) {
  float ratio = (float)ir / (float)FINGER_THRESHOLD;
  if (ratio < 1.3f) return 1;
  if (ratio < 1.8f) return 2;
  return 3;
}

// Trend arrow (5×5)
void drawArrow(int x, int y, bool up) {
  const uint8_t* bmp = up ? ARROW_UP_BMP : ARROW_DOWN_BMP;
  for (int row = 0; row < ARROW_H; row++) {
    uint8_t colData = pgm_read_byte(&bmp[row]);
    for (int col = 0; col < ARROW_W; col++) {
      if (colData & (1 << (ARROW_W - 1 - col)))
        oled.drawPixel(x + col, y + row, SSD1306_WHITE);
    }
  }
}

// Finger placement pulse rings
void drawFingerPulse(int cx, int cy, uint8_t frame) {
  oled.fillCircle(cx, cy, 2, SSD1306_WHITE);
  if (frame >= 1) oled.drawCircle(cx, cy, 5,  SSD1306_WHITE);
  if (frame >= 2) oled.drawCircle(cx, cy, 9,  SSD1306_WHITE);
  if (frame >= 3) oled.drawCircle(cx, cy, 13, SSD1306_WHITE);
}

// Quality heart row (5 hearts, filled or outlined)
void drawQualityHearts(int x, int y, int filled) {
  for (int i = 0; i < 5; i++) {
    int sx = x + i * 7;
    if (i < filled) {
      oled.drawBitmap(sx, y, HEART5_BMP, HEART5_W, HEART5_H, SSD1306_WHITE);
    } else {
      oled.drawRect(sx, y, 5, 5, SSD1306_WHITE);
    }
  }
}

// Segmented fill bar — N segments across a given width
void drawSegBar(int x, int y, int totalW, int segsTotal, int segsOn) {
  int segW = (totalW - (segsTotal - 1)) / segsTotal;
  for (int i = 0; i < segsTotal; i++) {
    int sx = x + i * (segW + 1);
    if (i < segsOn) oled.fillRect(sx, y, segW, 3, SSD1306_WHITE);
    else            oled.drawRect(sx, y, segW, 3, SSD1306_WHITE);
  }
}

// ================================================================
//  [UX-13] SESSION QUALITY
// ================================================================
const char* computeSessionQuality() {
  if (trendCount < 4) return "Short session";
  long sum = 0;
  for (uint8_t i = 0; i < trendCount; i++) {
    int idx = (trendHead - trendCount + i + BPM_TREND_SIZE) % BPM_TREND_SIZE;
    sum += bpmTrend[idx];
  }
  long mean = sum / trendCount;
  long varSum = 0;
  for (uint8_t i = 0; i < trendCount; i++) {
    int idx = (trendHead - trendCount + i + BPM_TREND_SIZE) % BPM_TREND_SIZE;
    long d = bpmTrend[idx] - mean; varSum += d * d;
  }
  long variance = varSum / trendCount, stddev = 0, est = variance;
  for (int iter = 0; iter < 20 && est > 0; iter++) {
    est = (est + variance / est) / 2; stddev = est;
  }
  if (stddev < 5)  return "Good session";
  if (stddev < 12) return "Fair session";
  return "Unstable-check";
}

int qualityToHearts(const char* q) {
  if (strcmp(q, "Good session")   == 0) return 3;
  if (strcmp(q, "Fair session")   == 0) return 2;
  if (strcmp(q, "Unstable-check") == 0) return 1;
  return 0;
}

// ================================================================
//  RESET MEASUREMENT
// ================================================================
void resetMeasurement() {
  avgBPM = 0; smoothBPM = 0.0f; prevBPM = 0; bpmInited = false;
  sampleIdx = 0; lastBeatSmp = 0; lastBeatMs = 0;
  rateIdx = 0; rateFilled = 0;
  for (byte i = 0; i < RATE_SIZE; i++) rateSamples[i] = 0;
  spo2Val = 0; spo2Valid = 0; spoBufIdx = 0; spoCycles = 0;
  spoHistIdx = 0; spoHistCount = 0;
  for (byte i = 0; i < 5; i++) spoHistory[i] = 0;
  hrAlert = false; spo2Alert = false; noFingerCount = 0;
  lastAlertBuzzAt = 0; needSleep = false;
  noTone(BUZZER_PIN); buzzActive = false;
  trendDir = 0; lastIrVal = 0;
  trendHead = 0; trendCount = 0; trendAt = 0;
  for (uint8_t i = 0; i < BPM_TREND_SIZE; i++) bpmTrend[i] = 0;
}

// ================================================================
//  LIGHT SLEEP
// ================================================================
void lightSleep() {
  noTone(BUZZER_PIN); buzzActive = false;
  oled.ssd1306_command(SSD1306_DISPLAYOFF);
  sensor.shutDown();
  while (true) {
    delay(450); sensor.wakeUp(); delay(150);
    long ir = 0;
    unsigned long t0 = millis();
    while (millis() - t0 < 50) {
      sensor.check();
      if (sensor.available()) { ir = sensor.getIR(); while (sensor.available()) sensor.nextSample(); break; }
      delay(5);
    }
    if (ir >= (long)FINGER_THRESHOLD) {
      delay(100);
      oled.ssd1306_command(SSD1306_DISPLAYON);
      resetMeasurement();
      sysState = STATE_WARMUP;
      return;
    }
    sensor.shutDown();
  }
}

// ================================================================
//  ALERTS
// ================================================================
void checkAlerts() {
  hrAlert = false; spo2Alert = false; hrHint = ""; spo2Hint = "";
  if (avgBPM >= HR_HIGH_BPM)                         { hrAlert  = true; hrMsg   = "HIGH HR";   hrHint  = "Breathe slowly";  }
  else if (avgBPM > 0 && avgBPM <= HR_LOW_BPM)       { hrAlert  = true; hrMsg   = "LOW HR";    hrHint  = "Sit down & rest"; }
  if (spo2Valid == 1 && spo2Val > 0 && spo2Val < SPO2_LOW_PCT)
                                                      { spo2Alert = true; spo2Msg = "LOW SpO2"; spo2Hint = "Take deep breath";}
}

// ================================================================
//  SCREEN: WAITING  [simplified — no ECG trace, no divider]
//
//  Layout (128×32):
//    Row 0..9   : WiFi icon (left) | "Place finger" centred | Battery (right)
//    Row 10..31 : Animated pulse rings centred
// ================================================================
void screenWaiting() {
  static uint8_t  pulseFrame = 0;
  static uint32_t pulseAt    = 0;

  if (millis() - pulseAt >= 420) { pulseFrame = (pulseFrame + 1) % 4; pulseAt = millis(); }

  oled.clearDisplay();
  oled.setTextSize(1);
  oled.setTextColor(SSD1306_WHITE);

  // WiFi icon — top-left
  bool wifiOk = (WiFi.status() == WL_CONNECTED);
  drawWifiIcon(1, 0, wifiOk);

  // "Place finger" — centred in header row
  oled.setCursor(30, 1);
  oled.print(F("Place finger"));

  // Battery — top-right
  drawBattery(116, 2);

  // Pulse rings centred in lower three-quarters
  drawFingerPulse(64, 22, pulseFrame);

  oled.display();
}

// ================================================================
//  SCREEN: WARMUP  [simplified — single seg-bar, "Calibrating"]
//
//  Layout (128×32):
//    Row 0..9   : Heart icon | "Warmup" label | Battery (right)
//    Row 10..24 : "Calibrating" text with blinking dot, centred
//    Row 27..31 : Single segmented progress bar (full width)
// ================================================================
void screenWarmup() {
  static bool     calDot = false;
  static uint32_t calAt  = 0;
  if (millis() - calAt >= 500) { calDot = !calDot; calAt = millis(); }

  oled.clearDisplay();
  oled.setTextSize(1);
  oled.setTextColor(SSD1306_WHITE);

  // Heart icon + label
  oled.drawBitmap(1, 1, HEART_BMP, HEART_W, HEART_H, SSD1306_WHITE);
  oled.setCursor(11, 1);
  oled.print(F("Warmup"));

  // Battery — top-right
  drawBattery(116, 2);

  // "Calibrating" with blinking dot — centred vertically in middle area
  oled.setCursor(18, 13);
  oled.print(F("Calibrating"));
  if (calDot) oled.fillCircle(104, 16, 2, SSD1306_WHITE);

  // Single progress bar spanning full usable width
  int segsOn = map(constrain(spoCycles, 0, SPO2_WARMUP_CYCLES),
                   0, SPO2_WARMUP_CYCLES, 0, 8);
  drawSegBar(2, 28, 124, 8, segsOn);

  oled.display();
}

// ================================================================
//  SCREEN: READING  [simplified — two large numbers, centre line,
//                    trend arrow, signal bars, no sparkline/SpO2 arc]
//
//  Layout (128×32):
//    Row 0..8   : Heart(anim) | "BPM" | trend arrow | battery | "SpO2" (right)
//    Row 9      : Full-width horizontal rule
//    Row 10..31 : Left half = large BPM  |  Right half = large SpO2
//                 Vertical divider at x=63
//                 Signal bars bottom-right
// ================================================================
void screenReading() {
  static bool     heartFilled = false;
  static uint32_t heartAt     = 0;

  int beatInterval = (avgBPM > 0) ? (60000 / avgBPM) : 700;
  if ((int32_t)(millis() - heartAt) > beatInterval) { heartFilled = !heartFilled; heartAt = millis(); }

  // Collect BPM for trend direction
  if (avgBPM > 0 && millis() - trendAt >= BPM_TREND_INTERVAL) {
    bpmTrend[trendHead] = avgBPM;
    trendHead = (trendHead + 1) % BPM_TREND_SIZE;
    if (trendCount < BPM_TREND_SIZE) trendCount++;
    trendAt = millis();
    // Update trend direction
    if (trendCount >= 2) {
      int idxFirst = (trendHead - trendCount + BPM_TREND_SIZE) % BPM_TREND_SIZE;
      int idxLast  = (trendHead - 1 + BPM_TREND_SIZE) % BPM_TREND_SIZE;
      int delta    = bpmTrend[idxLast] - bpmTrend[idxFirst];
      if      (delta >  5) trendDir =  1;
      else if (delta < -5) trendDir = -1;
      else                 trendDir =  0;
    }
  }

  oled.clearDisplay();
  oled.setTextColor(SSD1306_WHITE);

  // ── Header row ──
  // Animated heart icon
  oled.drawBitmap(0, 1, HEART_BMP, HEART_W, HEART_H,
                  heartFilled ? SSD1306_WHITE : SSD1306_BLACK);
  if (!heartFilled) oled.drawRect(0, 1, HEART_W, HEART_H, SSD1306_WHITE);

  oled.setTextSize(1);
  oled.setCursor(10, 1);
  oled.print(F("BPM"));

  // Trend arrow (if active)
  if (trendDir != 0) drawArrow(30, 2, trendDir > 0);

  // SpO2 label — right half header
  oled.setCursor(74, 1);
  oled.print(F("SpO2"));

  // Battery — top-right
  drawBattery(116, 2);

  // ── Horizontal rule ──
  oled.drawLine(0, 9, 127, 9, SSD1306_WHITE);

  // ── Vertical divider ──
  oled.drawLine(63, 9, 63, 31, SSD1306_WHITE);

  // ── Left: large BPM value ──
  oled.setTextSize(2);
  if (avgBPM > 0) {
    oled.setCursor(2, 14);
    oled.print(avgBPM);
  } else {
    // Spinning wait indicator (simple 4-frame)
    static uint8_t  rdSpin   = 0;
    static uint32_t rdSpinAt = 0;
    if (millis() - rdSpinAt >= 200) { rdSpin = (rdSpin + 1) % 4; rdSpinAt = millis(); }
    const char* spinChars[] = { "-", "\\", "|", "/" };
    oled.setCursor(24, 14);
    oled.print(spinChars[rdSpin]);
  }

  // ── Right: large SpO2 value ──
  oled.setTextSize(2);
  if (spo2Valid == 1 && spo2Val >= 90 && spo2Val <= 100) {
    oled.setCursor(66, 14);
    oled.print((int)spo2Val);
    oled.setTextSize(1);
    oled.setCursor(66 + ((spo2Val >= 100) ? 24 : 18), 22);
    oled.print('%');
  } else {
    oled.setCursor(74, 14);
    oled.print(F("--"));
  }

  // ── Signal bars — bottom-right corner ──
  if (lastIrVal > 0) {
    int sigLevel = irToSignalLevel(lastIrVal);
    drawSignalBars(113, 21, sigLevel);
  }

  oled.display();
}

// ================================================================
//  SCREEN: ALERT  [simplified — no escalation bar, no unit labels]
//
//  Layout (128×32):
//    Row 0..9   : Blinking inverted alert header (type string)
//    Row 10..18 : Hint text centred
//    Row 9      : Horizontal rule (inside non-inverted frame)
//    Row 19..31 : Left = large BPM  |  Right = large SpO2
//                 Vertical divider at x=63
// ================================================================
void screenAlert() {
  static bool     blinkOn = false;
  static uint32_t blinkAt = 0;
  if (millis() - blinkAt > 350) { blinkOn = !blinkOn; blinkAt = millis(); }

  oled.clearDisplay();

  // ── Blinking header bar ──
  if (blinkOn) {
    oled.fillRect(0, 0, 128, 9, SSD1306_WHITE);
    oled.setTextColor(SSD1306_BLACK);
  } else {
    oled.drawRect(0, 0, 128, 9, SSD1306_WHITE);
    oled.setTextColor(SSD1306_WHITE);
  }

  // Build alert label string
  char alertBuf[24];
  if (hrAlert && spo2Alert) snprintf(alertBuf, sizeof(alertBuf), "%s | %s", hrMsg, spo2Msg);
  else if (hrAlert)         snprintf(alertBuf, sizeof(alertBuf), "%s", hrMsg);
  else                      snprintf(alertBuf, sizeof(alertBuf), "%s", spo2Msg);

  oled.setTextSize(1);
  int ax = (128 - (int)strlen(alertBuf) * 6) / 2;
  if (ax < 2) ax = 2;
  oled.setCursor(ax, 1);
  oled.print(alertBuf);

  // ── Hint text ──
  oled.setTextColor(SSD1306_WHITE);
  const char* hint = hrAlert ? (spo2Alert ? "Breathe deeply" : hrHint) : spo2Hint;
  int hx = (128 - (int)strlen(hint) * 6) / 2;
  if (hx < 0) hx = 0;
  oled.setCursor(hx, 11);
  oled.print(hint);

  // ── Vertical divider ──
  oled.drawLine(63, 9, 63, 31, SSD1306_WHITE);

  // ── Left: large BPM ──
  oled.setTextSize(2);
  oled.setCursor(2, 18);
  if (avgBPM > 0) oled.print(avgBPM);
  else            oled.print(F("--"));

  // ── Right: large SpO2 ──
  oled.setCursor(66, 18);
  if (spo2Valid == 1 && spo2Val > 0) {
    oled.print((int)spo2Val);
    oled.setTextSize(1);
    oled.setCursor(66 + ((spo2Val >= 100) ? 24 : 18), 26);
    oled.print('%');
  } else {
    oled.print(F("--"));
  }

  oled.display();
}

// ================================================================
//  SCREEN: SUMMARY  [simplified — no dashed divider, no sub-labels]
//
//  Layout (128×32):
//    Row 0..8   : "Session ended" | quality hearts (right)
//    Row 9      : Horizontal rule
//    Row 10..28 : Left = large BPM value  |  Right = large SpO2 value
//                 Solid vertical divider at x=63
//    Row 31     : Drain progress bar (pixel row, drains left to right)
// ================================================================
void screenSummary() {
  uint32_t elapsed = millis() - summaryAt;

  oled.clearDisplay();
  oled.setTextSize(1);
  oled.setTextColor(SSD1306_WHITE);

  // "Session ended" — top-left
  oled.setCursor(2, 1);
  oled.print(F("Session ended"));

  // Quality hearts — top-right
  int hearts = qualityToHearts(sessionQuality);
  drawQualityHearts(90, 2, hearts);

  // Horizontal rule
  oled.drawLine(0, 10, 127, 10, SSD1306_WHITE);

  // Vertical divider
  oled.drawLine(63, 10, 63, 30, SSD1306_WHITE);

  // Left: large BPM
  oled.setTextSize(2);
  oled.setCursor(2, 14);
  if (summaryBPM > 0) oled.print(summaryBPM);
  else                oled.print(F("--"));

  // Right: large SpO2
  oled.setCursor(66, 14);
  if (summarySpo2 > 0) {
    oled.print(summarySpo2);
    oled.setTextSize(1);
    oled.setCursor(66 + (summarySpo2 >= 100 ? 24 : 18), 22);
    oled.print('%');
  } else {
    oled.print(F("--"));
  }

  // Drain bar — single pixel row at bottom
  int remainPx = constrain((int)(128 - (long)elapsed * 128L / (long)SUMMARY_HOLD_MS), 0, 128);
  for (int x = 0; x < remainPx; x++) {
    oled.drawPixel(x, 31, SSD1306_WHITE);
  }

  oled.display();
}

// ================================================================
//  SENSOR INIT
// ================================================================
void initSensor() {
  if (!sensor.begin(Wire, I2C_SPEED_FAST)) {
    oled.clearDisplay(); oled.setTextSize(1); oled.setCursor(10, 4);
    oled.print(F("MAX30102 Error!")); oled.display();
    while (true) delay(1000);
  }
  sensor.setup(0x1F, 4, 2, 100, 411, 4096);
  sensor.setPulseAmplitudeRed(0x4F);
  sensor.setPulseAmplitudeIR(0x4F);
  sensor.setPulseAmplitudeGreen(0);

  uint32_t ambientIR = 0; int validSamples = 0;
  unsigned long t0 = millis();
  while (millis() - t0 < 500 && validSamples < 10) {
    sensor.check();
    if (sensor.available()) { ambientIR += sensor.getIR(); sensor.nextSample(); validSamples++; }
    delay(20);
  }
  if (validSamples > 0) {
    ambientIR /= validSamples;
    FINGER_THRESHOLD = max(40000UL, ambientIR + 15000UL);
  }
}

// ================================================================
//  SETUP
// ================================================================
void setup() {
  Serial.begin(115200);
  delay(100);

  pinMode(BUZZER_PIN, OUTPUT); noTone(BUZZER_PIN);
  pinMode(RESET_CREDS_PIN, INPUT);
  Wire.begin();
  EEPROM.begin(EE_SIZE);

  {
    float raw  = (float)analogRead(BAT_PIN);
    float vA0  = (raw / BAT_ADC_MAX) * BAT_ADC_VREF;
    float vBat = vA0 * BAT_DIVIDER_RATIO;
    batPct = constrain((int)(((vBat - BAT_EMPTY_V) / (BAT_FULL_V - BAT_EMPTY_V)) * 100.0f), 0, 100);
    batReadAt = millis();
  }

  oled.begin(SSD1306_SWITCHCAPVCC, OLED_ADDR);
  oled.clearDisplay(); oled.setTextColor(SSD1306_WHITE); oled.setTextSize(1);
  oled.setCursor(12, 3);  oled.print(F("HEALTH MONITOR"));
  oled.setCursor(28, 14); oled.print(F("v4.3.2"));
  if (batPct >= 0) {
    oled.setCursor(72, 14);
    if (batPct >= 99) oled.print(F("Charging"));
    else { oled.print(batPct); oled.print('%'); }
  }
  oled.display();
  delay(800);

  if (digitalRead(RESET_CREDS_PIN) == LOW) {
    delay(50);
    if (digitalRead(RESET_CREDS_PIN) == LOW) {
      eepromClearCredentials();
      oled.clearDisplay(); oled.setCursor(10, 4);
      oled.print(F("WiFi creds cleared")); oled.display();
      tone(BUZZER_PIN, 400, 200); delay(800);
    }
  }

  tone(BUZZER_PIN, 900, 80); delay(130);
  tone(BUZZER_PIN, 1400, 80); delay(130); noTone(BUZZER_PIN);

  if (eepromHasCredentials()) {
    bool connected = connectWiFi();
    if (!connected) { eepromClearCredentials(); startPortal(); runPortalLoop(); }
  } else {
    startPortal(); runPortalLoop();
  }

  oled.clearDisplay(); oled.setTextSize(1); oled.setCursor(8, 4);
  oled.print(F("WiFi Connected!")); oled.setCursor(0, 18);
  oled.print(WiFi.localIP()); oled.display();
  delay(1500);

  initSensor();
  sysState = STATE_WAITING;
}

// ================================================================
//  MAIN LOOP
// ================================================================
void loop() {
  if (sysState == STATE_WAITING) updateBattery();
  buzzUpdate();
  sensor.check();

  if (sysState == STATE_SUMMARY) {
    if (millis() - summaryAt >= SUMMARY_HOLD_MS) { screenWaiting(); lightSleep(); return; }
    static uint32_t lastSumDisp = 0;
    if (millis() - lastSumDisp >= 100) { lastSumDisp = millis(); screenSummary(); }
    return;
  }

  while (sensor.available()) {
    long irVal  = sensor.getIR();
    long redVal = sensor.getRed();
    sensor.nextSample();

    if (irVal < (long)FINGER_THRESHOLD) {
      if (++noFingerCount >= FINGER_DEBOUNCE) {
        if (sysState == STATE_READING || sysState == STATE_ALERT) {
          summaryBPM  = avgBPM;
          summarySpo2 = (spo2Valid == 1 && spo2Val >= 90 && spo2Val <= 100) ? spo2Val : 0;
          summaryAt   = millis();
          sessionQuality = computeSessionQuality();
          sysState    = STATE_SUMMARY;
          buzzPlay(SEQ_SUMMARY);
          noTone(BUZZER_PIN); buzzActive = false;
        } else {
          needSleep = true;
        }
        break;
      }
      continue;
    }
    noFingerCount = 0;
    lastIrVal = irVal;
    sampleIdx++;

    if (checkForBeat(irVal)) {
      uint32_t nowMs = millis();
      if (nowMs - lastBeatMs < MIN_BEAT_INTERVAL_MS) goto fillSpO2;
      lastBeatMs = nowMs;
      if (sampleIdx < BPM_GATE_SAMPLES) goto fillSpO2;
      {
        uint32_t deltaSmp = sampleIdx - lastBeatSmp;
        lastBeatSmp = sampleIdx;
        if (deltaSmp >= (uint32_t)(SAMPLE_RATE * 0.40f) &&
            deltaSmp <= (uint32_t)(SAMPLE_RATE * 1.5f)) {
          float instBPM = 60.0f * SAMPLE_RATE / (float)deltaSmp;
          if (instBPM < 45.0f || instBPM > 180.0f) goto fillSpO2;
          if (smoothBPM == 0.0f) smoothBPM = instBPM;
          smoothBPM = BPM_ALPHA * instBPM + (1.0f - BPM_ALPHA) * smoothBPM;
          int bpmInt = (int)smoothBPM;
          if (bpmInited && abs(bpmInt - prevBPM) > 25) goto fillSpO2;
          rateSamples[rateIdx] = (byte)bpmInt;
          rateIdx = (rateIdx + 1) % RATE_SIZE;
          if (rateFilled < RATE_SIZE) rateFilled++;
          int sum = 0;
          for (byte i = 0; i < rateFilled; i++) sum += rateSamples[i];
          avgBPM = sum / rateFilled;
          prevBPM = bpmInt; bpmInited = true;
          if (sysState == STATE_READING && !buzzActive) buzzPlay(SEQ_BEAT);
        }
      }
    }

    fillSpO2:
    irBuf[spoBufIdx]  = (uint32_t)irVal;
    redBuf[spoBufIdx] = (uint32_t)redVal;
    if (++spoBufIdx >= SPO2_BUFFER_SIZE) {
      spoBufIdx = 0;
      maxim_heart_rate_and_oxygen_saturation(
        irBuf, SPO2_BUFFER_SIZE, redBuf,
        &spo2Val, &spo2Valid, &hrAlgo, &hrAlgoValid);
      spoCycles++;

      if (hrAlgoValid == 1 && hrAlgo > 40 && hrAlgo < 180) {
        if (avgBPM == 0) avgBPM = (int)hrAlgo;
        else avgBPM = (int)(0.85f * (float)avgBPM + 0.15f * (float)hrAlgo);
      }

      if (spoCycles <= SPO2_WARMUP_CYCLES) {
        spo2Valid = 0;
      } else if (spo2Valid == 1 && spo2Val >= 90 && spo2Val <= 100) {
        spoHistory[spoHistIdx] = spo2Val;
        spoHistIdx = (spoHistIdx + 1) % 5;
        if (spoHistCount < 5) spoHistCount++;
        int sum = 0;
        for (byte i = 0; i < spoHistCount; i++) sum += spoHistory[i];
        spo2Val = sum / spoHistCount;
      } else {
        spo2Valid = 0;
      }

      if (spo2Valid == 1 && (sysState == STATE_READING || sysState == STATE_ALERT)) {
        if (millis() - lastDataSentAt >= SEND_INTERVAL) {
          sendDataToBackend(avgBPM, spo2Val);
          lastDataSentAt = millis();
        }
      }
    }
  }

  if (needSleep) {
    needSleep = false; resetMeasurement();
    sysState = STATE_WAITING; screenWaiting();
    lightSleep(); return;
  }

  if (sysState == STATE_WARMUP && spoCycles >= SPO2_WARMUP_CYCLES) {
    sysState = STATE_READING;
    buzzPlay(SEQ_READY);
    trendAt = millis();
  }

  checkAlerts();

  if ((hrAlert || spo2Alert) && sysState == STATE_READING) {
    sysState = STATE_ALERT;
    buzzPlay(SEQ_ALERT); lastAlertBuzzAt = millis();
  }
  if (!hrAlert && !spo2Alert && sysState == STATE_ALERT) {
    sysState = STATE_READING;
    noTone(BUZZER_PIN); buzzActive = false;
  }
  if (sysState == STATE_ALERT && !buzzActive && millis() - lastAlertBuzzAt >= 3000) {
    buzzPlay(SEQ_ALERT); lastAlertBuzzAt = millis();
  }

  static uint32_t lastDispAt = 0;
  if (millis() - lastDispAt >= 100) {
    lastDispAt = millis();
    switch (sysState) {
      case STATE_WAITING: screenWaiting(); break;
      case STATE_WARMUP:  screenWarmup();  break;
      case STATE_READING: screenReading(); break;
      case STATE_ALERT:   screenAlert();   break;
      case STATE_SUMMARY: screenSummary(); break;
    }
  }
}
