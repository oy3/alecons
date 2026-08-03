export const site = {
  name: "Alebiosu College of Nursing Sciences",
  shortName: "ALECONS",
  description:
    "A nursing sciences college in Omuoke, Ekiti State, committed to competent, compassionate and ethical nursing education.",
  address: "Iyamoye-Abuja Road, Omuoke, Ekiti State, Nigeria",
  phones: ["+234 916 000 8679", "+234 708 460 1610"],
  email: "info@alecons.edu.ng",
  admissionsEmail: "admissions@alecons.edu.ng",
  officeHours: [
    "Monday - Friday: 8:00 AM - 5:00 PM",
    "Saturday: 9:00 AM - 2:00 PM",
  ],
};

const applicationPortalUrl =
  import.meta.env.VITE_APP_APPLICATION_PORTAL_URL ||
  "https://apply.alecons.edu.ng";
const studentPortalUrl =
  import.meta.env.VITE_APP_STUDENT_PORTAL_URL ||
  "https://portal.alecons.edu.ng";
const staffPortalUrl =
  import.meta.env.VITE_APP_STAFF_PORTAL_URL || "https://staff.alecons.edu.ng";

export const portalLinks = [
  {
    label: "Applicant Portal",
    href: `${applicationPortalUrl.replace(/\/$/, "")}/register`,
  },
  {
    label: "Student Portal",
    href: studentPortalUrl,
  },
  {
    label: "Staff Portal",
    href: staffPortalUrl,
  },
];

export const applyUrl = portalLinks[0].href;

export const navigation = [
  { label: "Home", to: "/" },
  { label: "About", to: "/about" },
  { label: "Programmes", to: "/programs" },
  { label: "Admissions", to: "/admissions" },
  { label: "Faculty", to: "/faculty" },
  { label: "Contact", to: "/contact" },
];

export const announcement = {
  active: true,
  text: "Batch B admissions for the 2026/2027 academic session are now open.",
  linkLabel: "Apply now",
  href: applyUrl,
};

export const whatsappUrl = "https://wa.me/2347084601610";

export const statistics = [
  {
    value: 11,
    suffix: "+",
    label: "Years of excellence",
    note: "Serving Ekiti State",
  },
  {
    value: 60,
    suffix: "+",
    label: "Active students",
    note: "Learning from expert faculty",
  },
  {
    value: 15,
    suffix: "+",
    label: "Expert faculty",
    note: "Experienced professionals",
  },
  {
    value: 100,
    suffix: "%",
    label: "Digital admissions",
    note: "Simple, secure and paperless",
  },
];

export const socialLinks = [
  { label: "WhatsApp", icon: "bi-whatsapp", href: whatsappUrl },
];

export const departments = [
  {
    name: "Admissions Office",
    person: "Mr. Donatus Okoroji",
    phone: "+234 708 460 1610",
    email: "admissions@alecons.edu.ng",
  },
  {
    name: "Student Affairs",
    person: "Mr. Tunji Kehinde",
    phone: "Not published - please email",
    email: "support@alecons.edu.ng",
  },
  {
    name: "Academic Affairs",
    person: "Mrs. Osho",
    phone: "Not published - please email",
    email: "support@alecons.edu.ng",
  },
  {
    name: "Financial Services",
    person: "Mr. Donatus Okoroji",
    phone: "+234 708 460 1610",
    email: "payments@alecons.edu.ng",
  },
];
