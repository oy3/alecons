import simulation from "../assets/img/clinc-lab.jpg";
import skills from "../assets/img/skills-lab.jpg";
import library from "../assets/img/e-library.jpeg";
import ict from "../assets/img/ict-lab.jpg";
import gate from "../assets/img/campus/main-gate.jpg";
import block from "../assets/img/campus/academic-block.jpg";
import courtyard from "../assets/img/campus/courtyard.jpg";

export const facilities = [
  { title: "Simulation laboratory", description: "Simulation equipment and hospital-standard beds for hands-on clinical training.", image: simulation },
  { title: "Skills laboratory", description: "A comprehensive skills training facility with modern nursing equipment.", image: skills },
  { title: "Library & resource centre", description: "Nursing textbooks, journals and digital resources, including an e-library.", image: library },
  { title: "Computer laboratory", description: "A modern computer laboratory with internet access for research and learning.", image: ict },
];

export const campusGallery = [
  { src: gate, alt: "The main entrance gate at Alebiosu College of Nursing Sciences" },
  { src: block, alt: "ALECONS academic building and campus grounds" },
  { src: courtyard, alt: "Open courtyard within the ALECONS campus" },
  { src: simulation, alt: "Clinical simulation laboratory with training beds" },
  { src: library, alt: "ALECONS e-library learning space" },
];
