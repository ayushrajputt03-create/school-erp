import React from 'react'
import { MessageCircle, Phone } from 'lucide-react'
import './contact-widget.css'

// ============================================================
// ContactWidget — landing page ka floating WhatsApp + Call button
//
// Ye component jaan boojh kar `src/landing/` me hai aur sirf LandingPage.jsx
// se render hota hai. Requirement ye thi ki ye widget logged-in ERP screens
// (admin / teacher / parent) par kabhi na dikhe. Us shart ko ek `if` se
// sambhalna sabse kamzor tareeka hota — koi kal naya layout banata aur bhool
// jaata. Yahan wo shart dhaanche se hi poori hoti hai: App.jsx, TeacherApp.jsx
// aur ParentPortal.jsx me se koi ise import hi nahi karta, isliye wo bundle me
// hi nahi pahunchta.
//
// Number ek hi jagah likha hai. Pehle landing page par do jagah
// wa.me/919999999999 pada tha — ek dummy number jispar koi lead kabhi
// pahunchti hi nahi. Ab dono button, header aur footer sabhi PHONE se aate
// hain, to badalna ho to ek hi line badlegi.
// ============================================================

export const PHONE = '7290810294'
export const PHONE_E164 = `+91${PHONE}`
export const PHONE_DISPLAY = '+91 72908 10294'

const WHATSAPP_TEXT = "Hi, I'm interested in Northstar School OS for my school"
export const WHATSAPP_URL = `https://wa.me/91${PHONE}?text=${encodeURIComponent(WHATSAPP_TEXT)}`
export const TEL_URL = `tel:${PHONE_E164}`

export default function ContactWidget() {
  return <div className="ls-contact-widget">
    <a
      className="ls-contact-btn wa"
      href={WHATSAPP_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with us on WhatsApp"
    >
      <MessageCircle size={22} />
      <span>WhatsApp</span>
    </a>
    <a className="ls-contact-btn call" href={TEL_URL} aria-label={`Call us on ${PHONE_DISPLAY}`}>
      <Phone size={20} />
      <span>Call</span>
    </a>
  </div>
}
