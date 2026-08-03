import basicImage from "../assets/img/clinc-lab.jpg";
import publicHealthImage from "../assets/img/skills-lab.jpg";
import midwiferyImage from "../assets/img/campus/academic-block.jpg";
import postBasicImage from "../assets/img/campus/main-gate.jpg";

export const programmes = [
  {
    slug: "basic-nursing",
    name: "Basic Nursing",
    status: "enrolling",
    statusLabel: "Now enrolling",
    award: "RN Certificate",
    duration: "4 years",
    image: basicImage,
    description:
      "Comprehensive foundational nursing education covering anatomy, physiology, pharmacology and clinical practice, with extensive hands-on training in our simulation laboratories.",
    highlights: [
      "Clinical rotations in partner hospitals",
      "Simulation-based learning",
      "Professional development seminars",
      "NCLEX preparation support",
    ],
  },
  {
    slug: "public-health",
    name: "Public Health",
    status: "coming-soon",
    statusLabel: "Coming soon",
    award: "Public Health Diploma",
    duration: null,
    image: publicHealthImage,
    description:
      "A programme focused on community health, disease prevention and health promotion, training students to address population health challenges and improve public health outcomes.",
    highlights: [
      "Epidemiology and disease surveillance",
      "Community health assessment",
      "Health promotion and education",
      "Environmental health management",
    ],
  },
  {
    slug: "midwifery",
    name: "Midwifery",
    status: "coming-soon",
    statusLabel: "Coming soon",
    award: "Certified Midwife",
    duration: "2 years",
    image: midwiferyImage,
    description:
      "A specialised programme focused on maternal and infant care, reproductive health and family planning, with comprehensive training in normal and high-risk deliveries.",
    highlights: [
      "Maternal health specialisation",
      "Neonatal care training",
      "Community health outreach",
      "Family planning education",
    ],
  },
  {
    slug: "post-basic-nursing",
    name: "Post-Basic Nursing",
    status: "coming-soon",
    statusLabel: "Coming soon",
    award: "Post-Basic Nursing",
    duration: "18 months",
    image: postBasicImage,
    description:
      "A post-basic pathway for qualified nurses seeking further specialisation. Detailed programme content is yet to be published by the college.",
    highlights: [],
  },
];

export const getProgramme = (slug) =>
  programmes.find((programme) => programme.slug === slug);
