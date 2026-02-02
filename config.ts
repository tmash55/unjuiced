import { ConfigProps } from "./types/config";

const config = {
  websiteName:
    "Unjuiced: Smarter Sports Betting Insights & Tools",
  websiteUrl:
    process.env.NEXT_PUBLIC_WEBSITE_URL ||
    "https://unjuiced.bet/",
  websiteDescription:
    "Unjuiced helps sports bettors make sharper decisions with data-driven insights, prop analysis, and real-time odds comparison. Whether you're a casual fan or a seasoned bettor, our tools give you the edge to bet smarter and maximize value.",

  // REQUIRED
  appName: "Unjuiced",
  // REQUIRED: a short description of your app for SEO tags (can be overwritten)
  appDescription:
    "Unjuiced helps sports bettors make sharper decisions with data-driven insights, prop analysis, and real-time odds comparison. Whether you're a casual fan or a seasoned bettor, our tools give you the edge to bet smarter and maximize value.",
  // REQUIRED (no https://, not trialing slash at the end, just the naked domain)
  domainName: "unjuiced.bet",
  crisp: {
    // Crisp website ID. IF YOU DON'T USE CRISP: just remove this => Then add a support email in this config file (resend.supportEmail) otherwise customer support won't work.
    id: "",
    // Hide Crisp by default, except on route "/". Crisp is toggled with <ButtonSupport/>. If you want to show Crisp on every routes, just remove this below
    onlyShowOnRoutes: ["/"],
  },
  stripe: {
    plans: [
      // Scout Tier - Hit Rate Research
      {
        priceId: process.env.NEXT_PUBLIC_STRIPE_SCOUT_MONTHLY || "price_1SwQGeDHoRr1ai9XaPwfXaSR",
        name: "Scout – Monthly",
        description: "Hit rate research tools to find winning player props.",
        price: 15,
        tier: "scout",
        features: [
          { name: "All hit rate tools" },
          { name: "Defense vs Position matchups" },
          { name: "Hit Rate Matrix cheat sheets" },
          { name: "Player trend analysis" },
        ],
      },
      {
        priceId: process.env.NEXT_PUBLIC_STRIPE_SCOUT_YEARLY || "price_1SwQHHDHoRr1ai9XHWAZBHxE",
        name: "Scout – Yearly",
        description: "Hit rate research tools. Save 2 months with yearly billing.",
        price: 150,
        priceAnchor: 15,
        tier: "scout",
        features: [
          { name: "Everything in Scout Monthly" },
          { name: "2 months free (save $30)" },
        ],
      },
      // Sharp Tier - Hit Rates + Sharp Tools
      {
        isFeatured: true,
        priceId: process.env.NEXT_PUBLIC_STRIPE_SHARP_MONTHLY || "price_1SwQHpDHoRr1ai9XG5KgYpjq",
        name: "Sharp – Monthly",
        description: "Everything in Scout plus Positive EV, Arbitrage, and Edge Finder tools.",
        price: 35,
        tier: "sharp",
        features: [
          { name: "Everything in Scout" },
          { name: "Positive EV scanner" },
          { name: "Pregame Arbitrage finder" },
          { name: "Edge Finder tool" },
        ],
      },
      {
        isFeatured: true,
        priceId: process.env.NEXT_PUBLIC_STRIPE_SHARP_YEARLY || "price_1SwQIFDHoRr1ai9XMYYvBaLY",
        name: "Sharp – Yearly",
        description: "Full sharp betting toolkit. Save 2 months with yearly billing.",
        price: 350,
        priceAnchor: 35,
        tier: "sharp",
        features: [
          { name: "Everything in Sharp Monthly" },
          { name: "2 months free (save $70)" },
        ],
      },
      // Edge Tier - Everything + Live Arb + Custom Models
      {
        priceId: process.env.NEXT_PUBLIC_STRIPE_EDGE_MONTHLY || "price_1SwQIgDHoRr1ai9XaVvzPu5t",
        name: "Edge – Monthly",
        description: "Full platform access including Live Arbitrage, Custom Models, and EV-enhanced hit rates.",
        price: 65,
        tier: "edge",
        features: [
          { name: "Everything in Sharp" },
          { name: "Live Arbitrage alerts" },
          { name: "Custom Model builder" },
          { name: "EV-enhanced hit rates" },
        ],
      },
      {
        priceId: process.env.NEXT_PUBLIC_STRIPE_EDGE_YEARLY || "price_1SwQItDHoRr1ai9XFYDFVtuR",
        name: "Edge – Yearly",
        description: "Every advantage. Every tool. Save 2 months with yearly billing.",
        price: 650,
        priceAnchor: 65,
        tier: "edge",
        features: [
          { name: "Everything in Edge Monthly" },
          { name: "2 months free (save $130)" },
        ],
      },
    ],
  },

  aws: {
    // If you use AWS S3/Cloudfront, put values in here
    bucket: "bucket-name",
    bucketUrl: `https://bucket-name.s3.amazonaws.com/`,
    cdn: "https://cdn-id.cloudfront.net/",
  },
  resend: {
    // REQUIRED — Email 'From' field to be used when sending magic login links
    fromNoReply: `Unjuiced <noreply@unjuiced.bet>`,
    // REQUIRED — Email 'From' field to be used when sending other emails, like abandoned carts, updates etc..
    fromAdmin: `Unjuiced <support@unjuiced.bet>`,
    // Email shown to customer if need support. Leave empty if not needed => if empty, set up Crisp above, otherwise you won't be able to offer customer support."
    supportEmail: "support@unjuiced.bet",
  },
  colors: {
    // REQUIRED — The DaisyUI theme to use (added to the main layout.js). Leave blank for default (light & dark mode). If you any other theme than light/dark, you need to add it in config.tailwind.js in daisyui.themes.
    theme: "light",
    // REQUIRED — This color will be reflected on the whole app outside of the document (loading bar, Chrome tabs, etc..). By default it takes the primary color from your DaisyUI theme (make sure to update your the theme name after "data-theme=")
    // OR you can just do this to use a custom color: main: "#f37055". HEX only.
    main: "#570df8",
  },
  auth: {
    // REQUIRED — the path to log in users. It's use to protect private routes (like /dashboard). It's used in apiClient (/libs/api.js) upon 401 errors from our API
    loginUrl: "/login",
    // REQUIRED — the path you want to redirect users after successfull login (i.e. /dashboard, /private). This is normally a private page for users to manage their accounts. It's used in apiClient (/libs/api.js) upon 401 errors from our API & in ButtonSignin.js
    callbackUrl: "/today",
  },
} as ConfigProps;

export default config;