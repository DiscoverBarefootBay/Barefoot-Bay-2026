/**
 * Create predefined vendor listings for Barefoot Bay community platform
 * 
 * This script contains pre-written vendor content for each category:
 * - Food & Dining
 * - Landscaping
 * - Home Services
 * - Professional Services
 * - Retails
 * - Automotive
 * - Technology
 * - Other
 * 
 * Output follows the correct slug format: vendors-[category]-[vendor-name]
 * 
 * Usage:
 * node create-predefined-vendors.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import pkg from 'pg';
const { Pool } = pkg;

// Get the directory name properly in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Database connection config (uses DATABASE_URL from environment)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Define vendor categories from admin panel
const VENDOR_CATEGORIES = [
  {
    slug: "food-dining",
    name: "Food & Dining",
    vendors: [
      {
        title: "Barefoot Bay Bistro",
        slug: "vendors-food-dining-barefoot-bay-bistro",
        content: `<h2>Barefoot Bay Bistro</h2>
        <div class="vendor-description">
          <p>Welcome to Barefoot Bay Bistro, a family-owned restaurant serving the Barefoot Bay community since 2008. Our culinary team is dedicated to creating delicious, fresh meals using locally-sourced ingredients whenever possible.</p>
          
          <p>At Barefoot Bay Bistro, we believe dining should be an experience to enjoy with friends and family. Our relaxed atmosphere and attentive service make us a favorite gathering spot for residents and visitors alike.</p>
          
          <h3>Our Specialties</h3>
          <ul>
            <li>Fresh seafood platters featuring local catches</li>
            <li>Hand-cut steaks and chops</li>
            <li>Homemade pastas and signature sauces</li>
            <li>Delectable desserts made in-house daily</li>
            <li>Extensive wine list and craft cocktails</li>
            <li>Early bird specials (4PM-6PM)</li>
          </ul>
          
          <div class="vendor-contact">
            <h3>Contact Information</h3>
            <p><strong>Phone:</strong> (321) 555-1234</p>
            <p><strong>Email:</strong> info@barefootbaybistro.com</p>
            <p><strong>Website:</strong> www.barefootbaybistro.com</p>
            
            <h3>Hours of Operation</h3>
            <p>Tuesday - Sunday: 11:00 AM - 9:00 PM</p>
            <p>Monday: Closed</p>
            
            <h3>Location</h3>
            <p>8725 Barefoot Bay Blvd, Barefoot Bay, FL 32976</p>
            <p>Located in the Barefoot Bay Plaza, next to the community center</p>
          </div>
        </div>`
      },
      {
        title: "Coastal Catch Seafood Market & Grill",
        slug: "vendors-food-dining-coastal-catch-seafood-market-grill",
        content: `<h2>Coastal Catch Seafood Market & Grill</h2>
        <div class="vendor-description">
          <p>Coastal Catch is Barefoot Bay's premier destination for the freshest seafood. Our market offers daily catches from local fishermen, while our grill serves up perfectly prepared seafood dishes in a casual waterfront setting.</p>
          
          <p>Owned and operated by the Rodriguez family for over 15 years, we're proud to be a community favorite for both dining in and taking home the catch of the day to prepare yourself.</p>
          
          <h3>Our Services</h3>
          <ul>
            <li>Fresh seafood market with daily local catches</li>
            <li>Full-service restaurant with indoor and outdoor seating</li>
            <li>Raw bar featuring oysters, clams, and peel-and-eat shrimp</li>
            <li>Take-out and catering services</li>
            <li>Seafood preparation advice and cooking classes</li>
            <li>Weekly specials and seniors discount days</li>
          </ul>
          
          <div class="vendor-contact">
            <h3>Contact Information</h3>
            <p><strong>Phone:</strong> (321) 555-2468</p>
            <p><strong>Email:</strong> orders@coastalcatchseafood.com</p>
            <p><strong>Website:</strong> www.coastalcatchseafood.com</p>
            
            <h3>Hours of Operation</h3>
            <p>Market Hours: Monday - Saturday: 9:00 AM - 6:00 PM, Sunday: 10:00 AM - 4:00 PM</p>
            <p>Grill Hours: Wednesday - Sunday: 11:00 AM - 8:00 PM</p>
            
            <h3>Location</h3>
            <p>937 Indian River Drive, Barefoot Bay, FL 32976</p>
            <p>Waterfront location with dock access for boaters</p>
          </div>
        </div>`
      }
    ]
  },
  {
    slug: "landscaping",
    name: "Landscaping",
    vendors: [
      {
        title: "Tropical Paradise Landscaping",
        slug: "vendors-landscaping-tropical-paradise-landscaping",
        content: `<h2>Tropical Paradise Landscaping</h2>
        <div class="vendor-description">
          <p>Tropical Paradise Landscaping has been transforming Barefoot Bay properties into lush, beautiful outdoor spaces since 2005. We specialize in Florida-friendly landscaping that thrives in our unique climate while conserving water and reducing maintenance.</p>
          
          <p>Our team of certified horticulturists and landscape designers work closely with each client to create customized outdoor environments that reflect your personal style and enhance your property's value.</p>
          
          <h3>Our Services</h3>
          <ul>
            <li>Landscape design and installation</li>
            <li>Drought-resistant and native Florida plantings</li>
            <li>Irrigation system installation and maintenance</li>
            <li>Hardscape design (patios, walkways, retaining walls)</li>
            <li>Tree trimming and removal</li>
            <li>Regular maintenance programs</li>
            <li>Seasonal color rotations and flower bed maintenance</li>
          </ul>
          
          <div class="vendor-contact">
            <h3>Contact Information</h3>
            <p><strong>Phone:</strong> (321) 555-7890</p>
            <p><strong>Email:</strong> info@tropicalparadiselandscaping.com</p>
            <p><strong>Website:</strong> www.tropicalparadiselandscaping.com</p>
            
            <h3>Hours of Operation</h3>
            <p>Monday - Friday: 7:00 AM - 5:00 PM</p>
            <p>Saturday: 8:00 AM - 2:00 PM</p>
            <p>Sunday: Closed</p>
            
            <h3>Location</h3>
            <p>451 Garden Way, Barefoot Bay, FL 32976</p>
            <p>Serving all of Barefoot Bay and surrounding communities</p>
          </div>
        </div>`
      },
      {
        title: "Bay Area Lawn & Garden",
        slug: "vendors-landscaping-bay-area-lawn-garden",
        content: `<h2>Bay Area Lawn & Garden</h2>
        <div class="vendor-description">
          <p>Bay Area Lawn & Garden is a family-owned business dedicated to keeping your outdoor spaces beautiful and healthy. With over 20 years of experience serving the Barefoot Bay community, we understand the unique challenges of Florida lawns and gardens.</p>
          
          <p>Our professional team provides reliable, consistent service with attention to detail and respect for your property. We pride ourselves on our eco-friendly practices and sustainable approach to lawn and garden maintenance.</p>
          
          <h3>Our Services</h3>
          <ul>
            <li>Weekly lawn maintenance and mowing</li>
            <li>Fertilization and pest control programs</li>
            <li>Garden bed maintenance and weeding</li>
            <li>Mulch and decorative stone installation</li>
            <li>Palm tree trimming and seasonal pruning</li>
            <li>Sod installation and lawn renovation</li>
            <li>Special services for seasonal residents</li>
          </ul>
          
          <div class="vendor-contact">
            <h3>Contact Information</h3>
            <p><strong>Phone:</strong> (321) 555-3456</p>
            <p><strong>Email:</strong> service@bayarealawn.com</p>
            <p><strong>Website:</strong> www.bayarealawn.com</p>
            
            <h3>Hours of Operation</h3>
            <p>Monday - Friday: 7:00 AM - 6:00 PM</p>
            <p>Saturday: 8:00 AM - 3:00 PM</p>
            <p>Sunday: Emergency services only</p>
            
            <h3>Location</h3>
            <p>2145 Micco Road, Barefoot Bay, FL 32976</p>
            <p>Locally owned and operated in Barefoot Bay</p>
          </div>
        </div>`
      }
    ]
  },
  {
    slug: "home-services",
    name: "Home Services",
    vendors: [
      {
        title: "Barefoot Bay Home Maintenance",
        slug: "vendors-home-services-barefoot-bay-home-maintenance",
        content: `<h2>Barefoot Bay Home Maintenance</h2>
        <div class="vendor-description">
          <p>Barefoot Bay Home Maintenance is your trusted partner for all home repair and maintenance needs. For over 15 years, we've been helping Barefoot Bay homeowners protect their investments and maintain comfortable, functional living spaces.</p>
          
          <p>Our team of licensed professionals includes plumbers, electricians, HVAC technicians, and general contractors, allowing us to handle virtually any home maintenance task. We pride ourselves on prompt service, quality workmanship, and competitive pricing.</p>
          
          <h3>Our Services</h3>
          <ul>
            <li>Plumbing repairs and installations</li>
            <li>Electrical troubleshooting and updates</li>
            <li>HVAC maintenance and repair</li>
            <li>Handyman services and general repairs</li>
            <li>Interior and exterior painting</li>
            <li>Hurricane preparedness and protection</li>
            <li>Seasonal home checks for part-time residents</li>
          </ul>
          
          <div class="vendor-contact">
            <h3>Contact Information</h3>
            <p><strong>Phone:</strong> (321) 555-4321</p>
            <p><strong>Email:</strong> service@barefootbaymaintenance.com</p>
            <p><strong>Website:</strong> www.barefootbaymaintenance.com</p>
            
            <h3>Hours of Operation</h3>
            <p>Monday - Friday: 8:00 AM - 5:00 PM</p>
            <p>Saturday: 9:00 AM - 2:00 PM</p>
            <p>24/7 Emergency Services Available</p>
            
            <h3>Location</h3>
            <p>537 Commerce Parkway, Barefoot Bay, FL 32976</p>
            <p>Serving the entire Barefoot Bay community</p>
          </div>
        </div>`
      },
      {
        title: "Sunshine State Cleaning Services",
        slug: "vendors-home-services-sunshine-state-cleaning-services",
        content: `<h2>Sunshine State Cleaning Services</h2>
        <div class="vendor-description">
          <p>Sunshine State Cleaning Services provides professional residential cleaning solutions for busy homeowners in Barefoot Bay. With our attention to detail and commitment to excellence, we ensure your home is spotless, healthy, and welcoming.</p>
          
          <p>All our cleaning technicians are thoroughly trained, background-checked, and insured. We use eco-friendly cleaning products that are safe for your family, pets, and the environment while still delivering exceptional cleaning results.</p>
          
          <h3>Our Services</h3>
          <ul>
            <li>Regular weekly, bi-weekly, or monthly cleaning</li>
            <li>Deep cleaning and spring cleaning services</li>
            <li>Move-in/move-out cleaning</li>
            <li>Window and screen cleaning</li>
            <li>Carpet and upholstery cleaning</li>
            <li>Vacation home turnover service</li>
            <li>One-time cleaning for special occasions</li>
          </ul>
          
          <div class="vendor-contact">
            <h3>Contact Information</h3>
            <p><strong>Phone:</strong> (321) 555-9876</p>
            <p><strong>Email:</strong> schedule@sunshinecleaning.com</p>
            <p><strong>Website:</strong> www.sunshinestatecleaning.com</p>
            
            <h3>Hours of Operation</h3>
            <p>Monday - Friday: 8:00 AM - 5:00 PM</p>
            <p>Saturday: 9:00 AM - 2:00 PM</p>
            <p>Sunday: Closed</p>
            
            <h3>Location</h3>
            <p>735 Barefoot Bay Circle, Barefoot Bay, FL 32976</p>
            <p>Proudly serving Barefoot Bay since 2010</p>
          </div>
        </div>`
      }
    ]
  },
  {
    slug: "professional-services",
    name: "Professional Services",
    vendors: [
      {
        title: "Coastal Financial Advisors",
        slug: "vendors-professional-services-coastal-financial-advisors",
        content: `<h2>Coastal Financial Advisors</h2>
        <div class="vendor-description">
          <p>Coastal Financial Advisors specializes in retirement planning and wealth management for Barefoot Bay residents. Our certified financial planners have over 30 years of combined experience helping clients secure their financial future and enjoy their retirement years with confidence.</p>
          
          <p>We take a personalized approach to financial planning, understanding that each client has unique goals, concerns, and circumstances. Our advisors are committed to providing objective advice and transparent fee structures with no hidden costs.</p>
          
          <h3>Our Services</h3>
          <ul>
            <li>Retirement planning and income strategies</li>
            <li>Investment management and portfolio analysis</li>
            <li>Social Security optimization</li>
            <li>Estate planning and wealth transfer</li>
            <li>Tax planning and minimization strategies</li>
            <li>Long-term care insurance planning</li>
            <li>Financial workshops and educational seminars</li>
          </ul>
          
          <div class="vendor-contact">
            <h3>Contact Information</h3>
            <p><strong>Phone:</strong> (321) 555-8765</p>
            <p><strong>Email:</strong> info@coastalfinancialadvisors.com</p>
            <p><strong>Website:</strong> www.coastalfinancialadvisors.com</p>
            
            <h3>Hours of Operation</h3>
            <p>Monday - Thursday: 9:00 AM - 5:00 PM</p>
            <p>Friday: 9:00 AM - 4:00 PM</p>
            <p>Evenings and weekends by appointment</p>
            
            <h3>Location</h3>
            <p>1422 Professional Plaza, Suite 203, Barefoot Bay, FL 32976</p>
            <p>Complimentary consultations available for Barefoot Bay residents</p>
          </div>
        </div>`
      },
      {
        title: "Bay Area Legal Services",
        slug: "vendors-professional-services-bay-area-legal-services",
        content: `<h2>Bay Area Legal Services</h2>
        <div class="vendor-description">
          <p>Bay Area Legal Services is a full-service law firm dedicated to meeting the legal needs of Barefoot Bay residents. Our team of experienced attorneys provides compassionate, competent legal representation across a wide range of practice areas.</p>
          
          <p>We understand the unique concerns of our senior community members and offer specialized legal services for older adults. Our convenient location and flexible scheduling options make legal services accessible to all Barefoot Bay residents.</p>
          
          <h3>Our Practice Areas</h3>
          <ul>
            <li>Estate planning, wills, and trusts</li>
            <li>Probate administration and litigation</li>
            <li>Elder law and guardianship</li>
            <li>Real estate transactions and disputes</li>
            <li>Personal injury claims</li>
            <li>Business law and contracts</li>
            <li>Mediation and alternative dispute resolution</li>
          </ul>
          
          <div class="vendor-contact">
            <h3>Contact Information</h3>
            <p><strong>Phone:</strong> (321) 555-5432</p>
            <p><strong>Email:</strong> contact@bayarealegal.com</p>
            <p><strong>Website:</strong> www.bayarealegalservices.com</p>
            
            <h3>Hours of Operation</h3>
            <p>Monday - Friday: 9:00 AM - 5:00 PM</p>
            <p>Evening and weekend appointments available upon request</p>
            
            <h3>Location</h3>
            <p>875 Legal Lane, Suite 101, Barefoot Bay, FL 32976</p>
            <p>Free initial consultations for Barefoot Bay residents</p>
          </div>
        </div>`
      }
    ]
  },
  {
    slug: "retails",
    name: "Retails",
    vendors: [
      {
        title: "Barefoot Bay Gift Boutique",
        slug: "vendors-retails-barefoot-bay-gift-boutique",
        content: `<h2>Barefoot Bay Gift Boutique</h2>
        <div class="vendor-description">
          <p>Barefoot Bay Gift Boutique offers a charming collection of unique gifts, home décor, jewelry, and clothing. Our carefully curated merchandise showcases coastal-inspired items, many from local artisans and designers that you won't find in chain stores.</p>
          
          <p>Whether you're searching for the perfect birthday present, hostess gift, or something special to brighten your own home, our friendly staff is dedicated to helping you find exactly what you're looking for.</p>
          
          <h3>Our Merchandise</h3>
          <ul>
            <li>Coastal and beach-themed home décor</li>
            <li>Handcrafted jewelry from local artisans</li>
            <li>Florida-inspired clothing and accessories</li>
            <li>Unique greeting cards and stationery</li>
            <li>Gourmet food items and gift baskets</li>
            <li>Bath, body, and aromatherapy products</li>
            <li>Seasonal decorations and gifts</li>
          </ul>
          
          <div class="vendor-contact">
            <h3>Contact Information</h3>
            <p><strong>Phone:</strong> (321) 555-6543</p>
            <p><strong>Email:</strong> shop@barefootbaygifts.com</p>
            <p><strong>Website:</strong> www.barefootbaygiftboutique.com</p>
            
            <h3>Hours of Operation</h3>
            <p>Monday - Saturday: 10:00 AM - 6:00 PM</p>
            <p>Sunday: 11:00 AM - 4:00 PM</p>
            <p>Extended holiday hours in November and December</p>
            
            <h3>Location</h3>
            <p>925 Barefoot Bay Plaza, Barefoot Bay, FL 32976</p>
            <p>Next to Barefoot Bay Bistro in the main plaza</p>
          </div>
        </div>`
      },
      {
        title: "Sunshine Garden Center",
        slug: "vendors-retails-sunshine-garden-center",
        content: `<h2>Sunshine Garden Center</h2>
        <div class="vendor-description">
          <p>Sunshine Garden Center is Barefoot Bay's premier destination for plants, garden supplies, and outdoor living products. Our extensive selection includes Florida-friendly plants, tropical flowering species, fruit trees, and native varieties perfectly suited to our climate.</p>
          
          <p>Our knowledgeable staff includes certified master gardeners who can provide expert advice on plant selection, care, and landscape design. We're committed to helping you create and maintain beautiful outdoor spaces that thrive in our unique Florida environment.</p>
          
          <h3>Our Products</h3>
          <ul>
            <li>Native Florida plants and drought-resistant varieties</li>
            <li>Tropical flowering plants and ornamentals</li>
            <li>Fruit trees and edible gardens</li>
            <li>Quality garden tools and supplies</li>
            <li>Organic soils, mulches, and fertilizers</li>
            <li>Decorative pots, planters, and garden art</li>
            <li>Patio furniture and outdoor living accessories</li>
          </ul>
          
          <div class="vendor-contact">
            <h3>Contact Information</h3>
            <p><strong>Phone:</strong> (321) 555-7654</p>
            <p><strong>Email:</strong> info@sunshinegardencenter.com</p>
            <p><strong>Website:</strong> www.sunshinegardencenter.com</p>
            
            <h3>Hours of Operation</h3>
            <p>Monday - Saturday: 8:00 AM - 6:00 PM</p>
            <p>Sunday: 9:00 AM - 5:00 PM</p>
            
            <h3>Location</h3>
            <p>2130 Garden Way, Barefoot Bay, FL 32976</p>
            <p>2 acres of plants and garden supplies with plenty of parking</p>
          </div>
        </div>`
      }
    ]
  },
  {
    slug: "automotive",
    name: "Automotive",
    vendors: [
      {
        title: "Barefoot Bay Auto Service",
        slug: "vendors-automotive-barefoot-bay-auto-service",
        content: `<h2>Barefoot Bay Auto Service</h2>
        <div class="vendor-description">
          <p>Barefoot Bay Auto Service is a full-service automotive repair and maintenance facility serving the Barefoot Bay community since 2001. Our ASE-certified technicians use state-of-the-art diagnostic equipment and quality parts to keep your vehicle running safely and efficiently.</p>
          
          <p>We pride ourselves on honest, transparent service and fair pricing. Our team takes the time to explain needed repairs and maintenance, helping you make informed decisions about your vehicle without pressure or unnecessary upsells.</p>
          
          <h3>Our Services</h3>
          <ul>
            <li>Complete engine diagnostics and repair</li>
            <li>Scheduled maintenance and factory-recommended services</li>
            <li>Air conditioning and heating system repair</li>
            <li>Brake system service and repair</li>
            <li>Transmission service and repair</li>
            <li>Electrical system diagnosis</li>
            <li>Pre-purchase inspections for used vehicles</li>
            <li>Complimentary local shuttle service</li>
          </ul>
          
          <div class="vendor-contact">
            <h3>Contact Information</h3>
            <p><strong>Phone:</strong> (321) 555-2345</p>
            <p><strong>Email:</strong> service@barefootbayauto.com</p>
            <p><strong>Website:</strong> www.barefootbayautoservice.com</p>
            
            <h3>Hours of Operation</h3>
            <p>Monday - Friday: 7:30 AM - 5:30 PM</p>
            <p>Saturday: 8:00 AM - 2:00 PM</p>
            <p>Sunday: Closed</p>
            
            <h3>Location</h3>
            <p>1275 Automotive Drive, Barefoot Bay, FL 32976</p>
            <p>Conveniently located with a comfortable waiting area</p>
          </div>
        </div>`
      },
      {
        title: "Bay Area Detailing & Car Wash",
        slug: "vendors-automotive-bay-area-detailing-car-wash",
        content: `<h2>Bay Area Detailing & Car Wash</h2>
        <div class="vendor-description">
          <p>Bay Area Detailing & Car Wash keeps your vehicle looking its best inside and out. Our professional detailing services remove dirt, grime, and contaminants that regular washing can't address, protecting your vehicle's finish and preserving its value.</p>
          
          <p>We use premium products and techniques to deliver exceptional results for cars, trucks, SUVs, and RVs of all sizes. Our water conservation system and eco-friendly cleaning products minimize environmental impact while maximizing cleaning effectiveness.</p>
          
          <h3>Our Services</h3>
          <ul>
            <li>Express and deluxe exterior car wash packages</li>
            <li>Complete interior detailing and sanitation</li>
            <li>Paint correction and ceramic coating application</li>
            <li>Headlight restoration</li>
            <li>Windshield repair and water repellent treatment</li>
            <li>Mobile detailing at your home or office</li>
            <li>Monthly wash memberships with unlimited washes</li>
          </ul>
          
          <div class="vendor-contact">
            <h3>Contact Information</h3>
            <p><strong>Phone:</strong> (321) 555-9090</p>
            <p><strong>Email:</strong> info@bayareadetailing.com</p>
            <p><strong>Website:</strong> www.bayareadetailing.com</p>
            
            <h3>Hours of Operation</h3>
            <p>Monday - Saturday: 8:00 AM - 6:00 PM</p>
            <p>Sunday: 9:00 AM - 4:00 PM</p>
            
            <h3>Location</h3>
            <p>450 Clean Street, Barefoot Bay, FL 32976</p>
            <p>Comfortable waiting area with complimentary refreshments</p>
          </div>
        </div>`
      }
    ]
  },
  {
    slug: "technology",
    name: "Technology",
    vendors: [
      {
        title: "Barefoot Bay Computer Services",
        slug: "vendors-technology-barefoot-bay-computer-services",
        content: `<h2>Barefoot Bay Computer Services</h2>
        <div class="vendor-description">
          <p>Barefoot Bay Computer Services provides friendly, patient technology support for residents of all technical skill levels. We specialize in helping seniors navigate today's digital world with confidence through personalized training, troubleshooting, and repair services.</p>
          
          <p>Our technicians explain technical concepts in easy-to-understand language without jargon or condescension. We're committed to building long-term relationships with our clients and being your trusted technology advisor in Barefoot Bay.</p>
          
          <h3>Our Services</h3>
          <ul>
            <li>Computer repair and virus/malware removal</li>
            <li>One-on-one technology training sessions</li>
            <li>Smartphone and tablet setup and troubleshooting</li>
            <li>WiFi network optimization and security</li>
            <li>Data backup, recovery, and transfer</li>
            <li>Smart home device setup and integration</li>
            <li>Remote support for quick problem resolution</li>
            <li>In-home service throughout Barefoot Bay</li>
          </ul>
          
          <div class="vendor-contact">
            <h3>Contact Information</h3>
            <p><strong>Phone:</strong> (321) 555-8888</p>
            <p><strong>Email:</strong> help@barefootbaycomputers.com</p>
            <p><strong>Website:</strong> www.barefootbaycomputerservices.com</p>
            
            <h3>Hours of Operation</h3>
            <p>Monday - Friday: 9:00 AM - 6:00 PM</p>
            <p>Saturday: 10:00 AM - 3:00 PM</p>
            <p>Evening appointments available upon request</p>
            
            <h3>Location</h3>
            <p>975 Tech Boulevard, Suite 107, Barefoot Bay, FL 32976</p>
            <p>Drop-in help desk available during business hours</p>
          </div>
        </div>`
      },
      {
        title: "Digital Coast Solutions",
        slug: "vendors-technology-digital-coast-solutions",
        content: `<h2>Digital Coast Solutions</h2>
        <div class="vendor-description">
          <p>Digital Coast Solutions is a full-service technology company serving both residential and small business clients in Barefoot Bay. We offer comprehensive IT services, web design, digital marketing, and technology consulting to help you thrive in today's connected world.</p>
          
          <p>Our team of certified professionals stays current with the latest technology trends and security best practices to provide you with reliable, future-proof solutions. We pride ourselves on delivering enterprise-level service with the personal touch of a local business.</p>
          
          <h3>Our Services</h3>
          <ul>
            <li>Managed IT services for small businesses</li>
            <li>Website design and development</li>
            <li>Social media management and digital marketing</li>
            <li>Cloud services and data security</li>
            <li>Business technology consulting</li>
            <li>Custom software development</li>
            <li>Technology workshops and group training</li>
          </ul>
          
          <div class="vendor-contact">
            <h3>Contact Information</h3>
            <p><strong>Phone:</strong> (321) 555-1010</p>
            <p><strong>Email:</strong> info@digitalcoastsolutions.com</p>
            <p><strong>Website:</strong> www.digitalcoastsolutions.com</p>
            
            <h3>Hours of Operation</h3>
            <p>Monday - Friday: 8:30 AM - 5:30 PM</p>
            <p>After-hours support available for business clients</p>
            
            <h3>Location</h3>
            <p>1550 Innovation Way, Suite 205, Barefoot Bay, FL 32976</p>
            <p>Free technology assessments for Barefoot Bay residents and businesses</p>
          </div>
        </div>`
      }
    ]
  },
  {
    slug: "other",
    name: "Other",
    vendors: [
      {
        title: "Barefoot Bay Pet Services",
        slug: "vendors-other-barefoot-bay-pet-services",
        content: `<h2>Barefoot Bay Pet Services</h2>
        <div class="vendor-description">
          <p>Barefoot Bay Pet Services provides professional, loving care for your furry family members. Our comprehensive pet care solutions include in-home pet sitting, dog walking, pet taxi services, and specialized care for elderly or special needs pets.</p>
          
          <p>All our pet care providers are bonded, insured, and trained in pet first aid and CPR. We treat your pets like family, ensuring they receive the attention, exercise, and affection they need when you're away or unable to provide care yourself.</p>
          
          <h3>Our Services</h3>
          <ul>
            <li>In-home pet sitting for all types of pets</li>
            <li>Daily dog walking and exercise</li>
            <li>Pet taxi to veterinarian and grooming appointments</li>
            <li>Medication administration for special needs pets</li>
            <li>House sitting with pet care</li>
            <li>Pet waste removal and yard cleanup</li>
            <li>Holiday and vacation coverage</li>
          </ul>
          
          <div class="vendor-contact">
            <h3>Contact Information</h3>
            <p><strong>Phone:</strong> (321) 555-7777</p>
            <p><strong>Email:</strong> care@barefootbaypets.com</p>
            <p><strong>Website:</strong> www.barefootbaypetservices.com</p>
            
            <h3>Hours of Operation</h3>
            <p>Office Hours: Monday - Friday: 9:00 AM - 5:00 PM</p>
            <p>Pet Care Services: 7 days a week, 6:00 AM - 9:00 PM</p>
            
            <h3>Location</h3>
            <p>375 Pet Haven Lane, Barefoot Bay, FL 32976</p>
            <p>Serving all of Barefoot Bay and surrounding communities</p>
          </div>
        </div>`
      },
      {
        title: "Coastal Senior Services",
        slug: "vendors-other-coastal-senior-services",
        content: `<h2>Coastal Senior Services</h2>
        <div class="vendor-description">
          <p>Coastal Senior Services is dedicated to helping Barefoot Bay seniors maintain their independence and quality of life through personalized assistance services. We provide reliable, compassionate support that allows older adults to age in place safely and comfortably.</p>
          
          <p>Our carefully screened caregivers provide non-medical assistance tailored to each client's unique needs and preferences. We develop individualized care plans that evolve as needs change, ensuring continuous appropriate support.</p>
          
          <h3>Our Services</h3>
          <ul>
            <li>Transportation to appointments, shopping, and social activities</li>
            <li>Light housekeeping and meal preparation</li>
            <li>Medication reminders and prescription pickups</li>
            <li>Grocery shopping and errands</li>
            <li>Companionship and social engagement</li>
            <li>Personal care assistance (bathing, dressing, etc.)</li>
            <li>Respite care for family caregivers</li>
          </ul>
          
          <div class="vendor-contact">
            <h3>Contact Information</h3>
            <p><strong>Phone:</strong> (321) 555-6789</p>
            <p><strong>Email:</strong> care@coastalseniorservices.com</p>
            <p><strong>Website:</strong> www.coastalseniorservices.com</p>
            
            <h3>Hours of Operation</h3>
            <p>Office Hours: Monday - Friday: 8:30 AM - 5:00 PM</p>
            <p>Caregiving Services: Available 24/7, including holidays</p>
            
            <h3>Location</h3>
            <p>825 Senior Way, Suite 103, Barefoot Bay, FL 32976</p>
            <p>Free in-home consultations for Barefoot Bay residents</p>
          </div>
        </div>`
      }
    ]
  }
];

/**
 * Save all vendors to JSON files
 */
async function saveVendorsToFiles() {
  console.log("Starting vendor content generation...");
  
  try {
    // Create output directory
    const outputDir = path.join(__dirname, 'predefined-vendors');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir);
    }
    
    // Track all vendors
    const allVendors = [];
    
    // Process each category
    for (const category of VENDOR_CATEGORIES) {
      if (category.vendors && category.vendors.length > 0) {
        // Save category vendors to a file
        const categoryFile = path.join(outputDir, `${category.slug}-vendors.json`);
        fs.writeFileSync(categoryFile, JSON.stringify(category.vendors, null, 2));
        
        // Add to all vendors
        allVendors.push(...category.vendors);
        
        console.log(`Saved ${category.vendors.length} ${category.name} vendors`);
      }
    }
    
    // Save all vendors to a single file
    const allVendorsFile = path.join(outputDir, 'all-vendors.json');
    fs.writeFileSync(allVendorsFile, JSON.stringify(allVendors, null, 2));
    
    console.log(`Vendor content generation complete! Saved ${allVendors.length} vendors across ${VENDOR_CATEGORIES.length} categories.`);
    console.log(`Output saved to: ${outputDir}`);
    
  } catch (error) {
    console.error("Error generating vendor content:", error);
  }
}

/**
 * Insert vendors into the database
 */
async function insertVendorsToDatabase() {
  console.log("Starting database insertion...");
  
  try {
    let insertCount = 0;
    
    // Process each category
    for (const category of VENDOR_CATEGORIES) {
      console.log(`Processing ${category.name} vendors...`);
      
      if (category.vendors && category.vendors.length > 0) {
        // Insert vendors into database
        for (const vendor of category.vendors) {
          // First check if this vendor already exists
          const vendorCheckResult = await pool.query(
            `SELECT * FROM page_contents WHERE slug = $1`,
            [vendor.slug]
          );
          
          if (vendorCheckResult.rows.length > 0) {
            console.log(`Vendor ${vendor.title} already exists, skipping.`);
            continue;
          }
          
          console.log(`Creating vendor ${vendor.title} for category ${category.name}...`);
          
          // Insert vendor
          await pool.query(
            `INSERT INTO page_contents 
             (slug, title, content, media_urls, updated_by, created_at, updated_at) 
             VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
            [
              vendor.slug,
              vendor.title,
              vendor.content,
              [], // No images for now
              6,  // Admin user ID
            ]
          );
          
          insertCount++;
        }
      }
    }
    
    console.log(`Database insertion complete! Added ${insertCount} new vendors.`);
    
  } catch (error) {
    console.error("Error inserting vendors into database:", error);
  } finally {
    // Close the database connection
    await pool.end();
  }
}

// Process command line arguments
const args = process.argv.slice(2);
if (args.includes('--db') || args.includes('-d')) {
  insertVendorsToDatabase().catch(console.error);
} else {
  saveVendorsToFiles().catch(console.error);
}