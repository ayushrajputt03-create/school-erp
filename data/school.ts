import {
  Award,
  BookOpen,
  Brain,
  CalendarCheck,
  CheckCircle2,
  Clock,
  GraduationCap,
  HeartHandshake,
  Lightbulb,
  MapPin,
  MessageSquareText,
  Phone,
  ShieldCheck,
  Sparkles,
  Trophy,
  UsersRound
} from "lucide-react";

export const school = {
  name: "TRIVENI TRIRATAN PUBLIC JR. HIGH SCHOOL",
  shortName: "Triveni Triratan Public Jr. High School",
  type: "Public Junior High School",
  principal: "Sh. Ravinder Kumar",
  address:
    "Prakash Vihar, Main 25 Feet Road, Loni, Ghaziabad, Uttar Pradesh 201102",
  locality: "Prakash Vihar, Loni, Ghaziabad",
  phone: "7838296298",
  secondaryPhone: "7838296298",
  displayPhone: "7838296298",
  whatsapp:
    "https://wa.me/917838296298?text=Hello%20Triveni%20School%2C%20I%20want%20admission%20inquiry.",
  whatsappWeb:
    "https://wa.me/917838296298?text=Hello%20Triveni%20School%2C%20I%20want%20admission%20inquiry.",
  mapQuery:
    "Triveni Triratan Public Jr. High School Prakash Vihar Main 25 Feet Road Loni Ghaziabad Uttar Pradesh 201102",
  openingHours: "Mon - Sat: 8:00 AM - 2:30 PM"
};

export const navItems = [
  { label: "About", href: "#about" },
  { label: "Admission", href: "#admissions" },
  { label: "Facilities", href: "#facilities" },
  { label: "Academics", href: "#academics" },
  { label: "Reviews", href: "#reviews" },
  { label: "Contact", href: "#contact" }
];

export const seoKeywords = [
  "Best school in Loni",
  "Best school near me",
  "Best school nearby",
  "Best school in Ghaziabad",
  "Public junior high school in Loni",
  "Admission open school in Loni",
  "Affordable school in Loni",
  "Best school for children in Loni"
];

export const heroStats = [
  { label: "Admission open", value: "2026-27" },
  { label: "Parent support helpline", value: "1" },
  { label: "Focus on learning, discipline, and values", value: "100%" }
];

export const reasons = [
  {
    icon: UsersRound,
    title: "Experienced Teachers",
    text: "Dedicated teachers explain concepts clearly, guide daily practice, and help children participate with confidence."
  },
  {
    icon: ShieldCheck,
    title: "Safe & Disciplined Environment",
    text: "A respectful routine, careful supervision, and disciplined school culture help children feel secure and focused."
  },
  {
    icon: GraduationCap,
    title: "Focus on Academic Excellence",
    text: "Regular lessons, revision, tests, and personal attention keep academic progress clear for students and parents."
  },
  {
    icon: HeartHandshake,
    title: "Value-Based Education",
    text: "Students are guided to build honesty, respect, manners, teamwork, and responsible behavior."
  },
  {
    icon: CalendarCheck,
    title: "Regular Tests & Parent Updates",
    text: "Frequent assessments and parent communication help families understand every child's growth."
  },
  {
    icon: Award,
    title: "Affordable Quality Education",
    text: "Quality schooling with practical guidance and admission support for families in Loni and nearby areas."
  },
  {
    icon: Lightbulb,
    title: "Activity-Based Learning",
    text: "Children learn through examples, activities, class participation, and guided practice."
  },
  {
    icon: BookOpen,
    title: "Strong Foundation for Students",
    text: "Reading, writing, mathematics, science, discipline, and confidence are developed step by step."
  }
];

export const facilities = [
  { icon: Sparkles, title: "Smart Learning Environment", text: "Classroom teaching is clear, interactive, and focused on practical understanding." },
  { icon: CheckCircle2, title: "Clean Classrooms", text: "Neat and organized classrooms create a healthy atmosphere for daily learning." },
  { icon: ShieldCheck, title: "Safe Campus", text: "Students learn in a supervised, disciplined, and child-friendly environment." },
  { icon: Trophy, title: "Sports & Activities", text: "Games, activities, assemblies, and events help children build confidence." },
  { icon: CalendarCheck, title: "Regular Unit Tests", text: "Frequent assessments support revision, improvement, and exam readiness." },
  { icon: MessageSquareText, title: "Parent-Teacher Communication", text: "Parents receive timely guidance about academic and personal progress." },
  { icon: HeartHandshake, title: "Moral Education", text: "The school gives daily importance to values, manners, respect, and discipline." },
  { icon: Brain, title: "Student Progress Tracking", text: "Teachers monitor classwork, tests, habits, and individual development." }
];

export const academics = [
  { icon: BookOpen, title: "Core Subjects", text: "English, Hindi, Mathematics, Science, Social Studies, and general knowledge are taught with strong basics." },
  { icon: Lightbulb, title: "Concept Clarity", text: "Lessons are explained with examples so students understand ideas, not just memorize answers." },
  { icon: CheckCircle2, title: "Revision & Tests", text: "Regular revision and unit tests keep children prepared and parents informed." },
  { icon: Award, title: "Student Development", text: "Confidence, communication, discipline, values, and responsibility grow together." }
];

export const testimonials = [
  {
    name: "Parent from Prakash Vihar",
    role: "Admission inquiry parent",
    quote:
      "The school gives proper attention to discipline and studies. Teachers guide children with care and communicate well."
  },
  {
    name: "Loni Parent",
    role: "Junior class parent",
    quote:
      "We wanted an affordable school in Loni with a safe environment. Triveni Triratan feels reliable for our child."
  },
  {
    name: "Ghaziabad Family",
    role: "Parent testimonial",
    quote:
      "Regular tests, personal attention, and moral education make this school a good choice for children."
  }
];

export const gallery = [
  {
    src: "/images/triveni-hero.png",
    alt: "Students walking with teacher at Triveni Triratan Public Jr. High School",
    title: "Safe School Environment"
  },
  {
    src: "/images/triveni-lab.png",
    alt: "Activity based learning and science practice at school",
    title: "Activity-Based Learning"
  },
  {
    src: "/images/triveni-classroom.png",
    alt: "Clean classroom learning with teacher guidance",
    title: "Clean Classrooms"
  },
  {
    src: "/images/triveni-toppers.jpeg",
    alt: "School toppers achievement poster",
    title: "Student Achievement"
  }
];

export const contactHighlights = [
  { icon: Phone, label: "Admission Helpline", value: school.displayPhone },
  { icon: MapPin, label: "Location", value: "Prakash Vihar, Main 25 Feet Road, Loni" },
  { icon: Clock, label: "School Hours", value: school.openingHours }
];
