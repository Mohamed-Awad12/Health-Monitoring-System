export const slideSections = [
  {
    id: "hero",
    eyebrow: "Smart Pulse Oximeter Platform",
    title: "Real-time remote monitoring for patients, doctors, and care teams.",
    description:
      "Pulse connects device telemetry, secure role-based dashboards, and live clinical visibility in one product built for continuous oxygen and heart-rate monitoring.",
    highlights: ["Live SpO2 + BPM streams", "Role-based dashboards", "Socket-powered updates"],
    stats: [
      { value: "3", label: "Core roles" },
      { value: "2", label: "Languages" },
      { value: "24/7", label: "Monitoring vision" },
    ],
  },
  {
    id: "about",
    eyebrow: "About",
    title: "A full-stack health monitoring system grounded in real product workflows.",
    description:
      "The platform combines secure auth, OTP verification, MongoDB-backed readings, threshold-based alerts, and a bilingual UI so monitoring feels dependable for both home care and clinical review.",
    highlights: [
      "JWT authentication with email verification",
      "Critical SpO2 and BPM alert evaluation",
      "English and Arabic with light/dark themes",
    ],
    narrative: [
      "Patients can link a device, review trends, request doctors, export reports, and generate AI-assisted summaries.",
      "Doctors can approve assignments, monitor live readings, and respond to alerts in real time.",
      "Admins can manage users and review doctor verification submissions from a single control layer.",
    ],
  },
  {
    id: "projects",
    eyebrow: "Projects",
    title: "Four product modules shape the experience end to end.",
    description:
      "This is not a single dashboard. It is a connected product surface spanning monitoring, clinical review, governance, and reporting.",
    cards: [
      {
        title: "Patient Workspace",
        text: "Device linking, vital overview, alert history, doctor requests, and downloadable health reports.",
      },
      {
        title: "Doctor Workspace",
        text: "Approval flow for new patient requests, assigned patient views, and shared live monitoring context.",
      },
      {
        title: "Admin Control",
        text: "User management, doctor verification review, and email verification support across the system.",
      },
      {
        title: "AI + Reports",
        text: "CSV and PDF exports plus bilingual assistant summaries with safe fallback behavior when AI is unavailable.",
      },
    ],
  },
  {
    id: "contact",
    eyebrow: "Contact",
    title: "Ready to present, pilot, or extend the product.",
    description:
      "The architecture already spans device ingestion, real-time transport, patient care workflows, and administrative governance, making Pulse ready for demos, university showcases, or production-oriented next steps.",
    highlights: ["Express + MongoDB backend", "React + Socket.IO frontend", "Three.js-ready product story"],
    ctas: [
      { label: "Open Main App", href: "__MAIN_APP_URL__", primary: true },
      { label: "Back To Hero", href: "#hero" },
    ],
  },
];
