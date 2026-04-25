const PDFDocument = require("pdfkit");

const buildCsvReport = ({ patient, readings }) => {
  const header = "Timestamp,SpO2,BPM\n";
  const rows = readings
    .map(
      (reading) =>
        `${new Date(reading.timestamp).toISOString()},${reading.spo2},${reading.bpm}`
    )
    .join("\n");

  return Buffer.from(
    `${header}${rows}\n\nGenerated For,${patient.name}\nEmail,${patient.email}\n`,
    "utf8"
  );
};

const buildPdfReport = ({ patient, range, summary, readings }) =>
  new Promise((resolve, reject) => {
    const document = new PDFDocument({ margin: 40 });
    const chunks = [];

    document.on("data", (chunk) => chunks.push(chunk));
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);

    // --- Header Section ---
    document
      .fillColor("#4f46e5") // Primary brand color
      .fontSize(26)
      .font("Helvetica-Bold")
      .text("Pulse Oximeter Report", { align: "center" });

    document.moveDown(0.25);
    document
      .fillColor("#64748b") // Muted color
      .fontSize(10)
      .font("Helvetica")
      .text(`Generated at: ${new Date().toLocaleString()}`, { align: "center" });

    document.moveDown(2);

    // --- Patient Information Box ---
    document
      .roundedRect(40, document.y, 530, 80, 8)
      .fillAndStroke("#f1f5f9", "#e2e8f0");

    document.fillColor("#0f172a").fontSize(12).font("Helvetica-Bold").text("Patient Details", 60, document.y - 65);
    document.moveDown(0.5);
    document.font("Helvetica").fontSize(10);
    document.text(`Name:   ${patient.name}`, 60, document.y);
    document.text(`Email:  ${patient.email}`, 60, document.y + 15);
    document.text(`Range:  ${range.toUpperCase()}`, 350, document.y - 15);
    document.moveDown(3);

    // --- Summary Section ---
    document.fillColor("#334155").fontSize(16).font("Helvetica-Bold").text("Vital Summary", 40, document.y);
    document.moveDown(0.5);

    const summaryY = document.y;
    
    // SpO2 Box
    document.roundedRect(40, summaryY, 255, 100, 8).fillAndStroke("#ecfdf5", "#bae6fd");
    document.fillColor("#0284c7").font("Helvetica-Bold").fontSize(14).text("Blood Oxygen (SpO2)", 55, summaryY + 15);
    document.fillColor("#0f172a").font("Helvetica").fontSize(12)
      .text(`Average: ${summary.averageSpo2 ?? "N/A"}%`, 55, summaryY + 45)
      .text(`Minimum: ${summary.minimumSpo2 ?? "N/A"}%`, 55, summaryY + 65);

    // BPM Box
    document.roundedRect(315, summaryY, 255, 100, 8).fillAndStroke("#fef2f2", "#fecaca");
    document.fillColor("#e11d48").font("Helvetica-Bold").fontSize(14).text("Heart Rate (BPM)", 330, summaryY + 15);
    document.fillColor("#0f172a").font("Helvetica").fontSize(12)
      .text(`Average: ${summary.averageBpm ?? "N/A"}`, 330, summaryY + 45)
      .text(`Maximum: ${summary.maximumBpm ?? "N/A"}`, 330, summaryY + 65);

    document.y = summaryY + 120;
    
    document.fillColor("#64748b").fontSize(10).text(`Total Readings Analyzed: ${summary.totalReadings}`, 40, document.y);
    document.moveDown(2);

    // --- Recent Measurements Table ---
    document.fillColor("#334155").fontSize(16).font("Helvetica-Bold").text("Recent Measurements", 40, document.y);
    document.moveDown(0.5);

    // Table Header
    document.rect(40, document.y, 530, 25).fill("#f8fafc");
    document.fillColor("#475569").font("Helvetica-Bold").fontSize(10);
    document.text("Date & Time", 55, document.y - 18);
    document.text("SpO2 (%)", 300, document.y - 18);
    document.text("Heart Rate (BPM)", 420, document.y - 18);
    document.moveDown(0.5);

    // Table Rows
    document.font("Helvetica").fontSize(10);
    readings.slice(-40).forEach((reading, i) => {
      const isCritical = reading.spo2 < 90 || reading.bpm > 120 || reading.bpm < 50;
      const y = document.y;
      
      if (i % 2 === 0) {
        document.rect(40, y - 5, 530, 20).fill("#f8fafc");
      }
      
      document.fillColor(isCritical ? "#e11d48" : "#334155");
      
      document.text(new Date(reading.timestamp).toLocaleString(), 55, y);
      document.text(reading.spo2.toString(), 300, y);
      document.text(reading.bpm.toString(), 420, y);
      document.moveDown(0.8);
    });

    document.end();
  });

module.exports = {
  buildCsvReport,
  buildPdfReport,
};
