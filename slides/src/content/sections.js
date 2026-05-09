export const slideSections = [
  {
    id: "intro",
    eyebrow: "Portable Wireless",
    title: "Pulse Oximeter",
    description:
      "Remote Health Monitoring System",
    highlights: [
      "Faculty of Engineering",
      "Damanhour University",
      "Communications & Electronics Dept.",
    ],
    media: [
      {
        type: "placeholder",
        title: "University Logo",
        note: "Add university logo (PNG or SVG)",
      },
      {
        type: "placeholder",
        title: "Faculty Logo",
        note: "Add faculty logo (PNG or SVG)",
      },
    ],
  },
  {
    id: "team",
    eyebrow: "Team Members",
    title: "Project Team",
    description: "Names and academic IDs.",
    list: [
      "Hossam Rabie Alwani - ID: 22170160",
      "Abd El-Rahman Sabry Kamel - ID: 23170153",
      "Kareem Essam El-Sayed - ID: 22170191",
      "Mohamed Ashraf Mohamed Haddad - ID: 22170193",
      "Mohamed Khaled Mohamed - ID: 22170195",
      "Mohamed Sha'ban El-Gamal - ID: 22170197",
      "Mohamed Kareem El-Sharqawy - ID: 22170200",
      "Mohamed Mohamed Ibrahim - ID: 22170201",
      "Mohamed Mahmoud Shehata - ID: 22170202",
    ],
  },
  {
    id: "index",
    eyebrow: "Table of Contents",
    title: "Presentation Outline",
    description: "Key sections of the project walkthrough.",
    list: [
      "01  Problem Statement",
      "02  Solution Idea",
      "03  Electronic Circuit Design",
      "04  Circuit Simulation",
      "05  PCB Design",
      "06  Components & Budget",
      "07  Challenges",
      "08  Project Demo Video",
      "09  Future Work",
    ],
  },
  {
    id: "problem",
    eyebrow: "Problem Statement",
    title: "Why the project is needed",
    description:
      "Continuous SpO2 and heart-rate visibility is critical, yet most settings lack real-time monitoring and clinical connectivity.",
    narrative: [
      "Limited Access to Continuous Monitoring: Patients in remote areas or home settings lack continuous SpO2 and BPM monitoring, delaying diagnosis of critical conditions like hypoxemia.",
      "High Cost of Clinical Equipment: Hospital-grade pulse oximeters are expensive and not portable, with no affordable IoT solution that connects patients to providers.",
      "No Remote Doctor Visibility: Consumer devices show data locally only, giving doctors no real-time access to patient readings.",
      "No Role-Based Health Platform: Existing systems lack structured Patient, Doctor, and Admin roles for organized monitoring, alerts, and data management.",
    ],
  },
  {
    id: "solution",
    eyebrow: "Solution Idea",
    title: "End-to-end remote health monitoring",
    description:
      "From sensor to doctor screen with secure, real-time data flow.",
    cards: [
      {
        title: "Hardware Device",
        text: "NodeMCU ESP8266, MAX30102 sensor, OLED display, battery powered.",
      },
      {
        title: "Data Transmission",
        text: "WiFi / Cloud, MQTT / HTTP, real-time upload, secure channel.",
      },
      {
        title: "Web Platform",
        text: "FastAPI backend, real-time dashboard, role-based access, alert system.",
      },
      {
        title: "User Roles",
        text: "Patient portal, doctor dashboard, admin panel, data analytics.",
      },
    ],
  },
  {
    id: "circuit",
    eyebrow: "Electronic Circuit Design",
    title: "Key Components",
    description: "Core hardware used in the prototype.",
    list: [
      "NodeMCU ESP8266 (CH340)",
      "MAX30102 SpO2 Sensor",
      "SSD1306 OLED 128x32",
      "MT3608 Boost Converter",
      "TP4056 Charging Module",
      "18650 Li-ion Battery",
      "2N2222 Transistor",
      "Piezo Buzzer (BZ1)",
    ],
  },
  {
    id: "simulation",
    eyebrow: "Circuit Simulation",
    title: "Validate before fabrication",
    description:
      "Wokwi / Proteus simulation validates I2C communication, MAX30102 readings, OLED output, and power stability.",
    media: [
      {
        type: "placeholder",
        title: "Simulation Screenshot",
        note: "Insert simulation image here",
      },
    ],
  },
  {
    id: "pcb",
    eyebrow: "PCB Design & Assembly",
    title: "Layout, power path, and signal integrity",
    description: "Highlights from the PCB design decisions.",
    narrative: [
      "PCB Layout: Designed in EasyEDA with optimized component placement for minimal noise and compact form factor.",
      "Power Path: TP4056 -> MT3608 boost -> 5V rail for NodeMCU with decoupling caps on all IC power pins.",
      "I2C Bus: 4.7k ohm pull-ups on SDA/SCL shared between MAX30102 and SSD1306 OLED.",
      "Form Factor: Designed for compact 18650 or LiPo battery enclosure with charging indicator.",
    ],
  },
  {
    id: "budget",
    eyebrow: "Components & Budget",
    title: "Bill of materials",
    description: "Component costs in EGP.",
    table: {
      columns: ["Component", "Qty", "Unit Price (EGP)", "Total (EGP)"],
      rows: [
        ["NodeMCU ESP8266 (CH340)", "1", "85", "85"],
        ["MAX30102 SpO2/HR Sensor", "1", "120", "120"],
        ["SSD1306 OLED 128x32 I2C", "1", "60", "60"],
        ["MT3608 Boost Converter", "1", "15", "15"],
        ["TP4056 Charging Module", "1", "12", "12"],
        ["18650 Li-ion Battery", "1", "45", "45"],
        ["PCB Fabrication", "1", "150", "150"],
        ["Resistors, Capacitors, etc.", "-", "20", "20"],
        ["Buzzer + Transistor", "1", "10", "10"],
        ["Enclosure / Housing", "1", "40", "40"],
      ],
    },
    tableFooter: "TOTAL BUDGET: 557 EGP",
  },
  {
    id: "challenges",
    eyebrow: "Challenges Faced",
    title: "Engineering and integration hurdles",
    description: "Key obstacles and how they were handled.",
    list: [
      "I2C Bus Conflicts: Missing 4.7k ohm pull-up resistors caused both devices to be unresponsive on first PCB bring-up.",
      "Power Rail Instability: MT3608 output ripple caused NodeMCU resets until additional decoupling caps were added.",
      "SpO2 Accuracy Calibration: The MAX30102 algorithm required R-value lookup tuning to achieve +/-2% accuracy.",
      "WiFi Connectivity in Low Signal: ESP8266 struggled to maintain MQTT connection; added reconnection logic and exponential backoff.",
      "PCB Routing & Noise: Analog traces near switching power rails introduced noise; resolved with ground plane partitioning.",
      "Battery Life Optimization: Continuous WiFi drained the 18650 in ~3 hours; added deep sleep intervals and buffered uploads.",
    ],
  },
  {
    id: "video",
    eyebrow: "Project Demo",
    title: "Live system walkthrough",
    description:
      "Demo Duration: <= 1 minute. Shows live SpO2 and BPM readings transmitted to the web dashboard.",
    media: [
      {
        type: "placeholder",
        title: "Insert Video Here",
        note: "Add a short demo video",
      },
    ],
  },
  {
    id: "future",
    eyebrow: "Future Work",
    title: "Next steps for the product",
    description: "Extensions planned beyond the current prototype.",
    list: [
      "AI-Powered Health Alerts: Detect anomalies in SpO2/BPM trends and issue predictive alerts before critical thresholds.",
      "Mobile Application: Build a React Native app for push notifications and history on the go.",
      "Multi-Sensor Expansion: Add ECG, temperature, and blood pressure sensors.",
      "Cloud & Telemedicine Integration: Connect to EHR systems (HL7 FHIR) and telemedicine services.",
      "Advanced Power Management: Adaptive deep sleep and solar charging to extend battery life to 48+ hours.",
      "3D-Printed Enclosure: Medical-grade enclosure with ergonomic finger clip and USB-C charging.",
    ],
  },
  {
    id: "thanks",
    eyebrow: "Thank You",
    title: "Portable Wireless Pulse Oximeter",
    description: "Faculty of Engineering - Damanhour University",
    highlights: ["Questions & Discussion"],
  },
];
