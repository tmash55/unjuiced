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
    // Create multiple plans in your Stripe dashboard, then add them here. You can add as many plans as you want, just make sure to add the priceId   
    productId: "prod_THGlf0qL4IYiAD",
        plans: [
          {
            // REQUIRED — used in webhooks and subscription logic
            priceId:
              process.env.NODE_ENV === "development"
                // If you have a test price for dev, put it here. For now, we'll reuse the live price ID.
                ? "price_1SKiDjDHoRr1ai9XQTH0H9iV"
                : "price_1SKiDjDHoRr1ai9XQTH0H9iV",

            // Displayed on pricing/checkout
            name: "Unjuiced Pro – Monthly",
            description:
              "Advanced betting analytics, real-time EV insights, and premium tools for smarter wagers.",
            // Display price (for UI only; Stripe charges by priceId)
            price: 39.99,
            // Optional: show anchor price (e.g., planned future price). Remove if not needed.
            // priceAnchor: 49.99,

            // Feature bullets for your pricing page
            features: [
              { name: "Real-time EV calculations" },
              { name: "Hit rate tracking and trends" },
              { name: "Betslip scanning & comparison" },
              { name: "Full access to premium tools" },
            ],

            // Optional metadata for internal use (passed to Stripe if you create sessions programmatically)
            metadata: {
              billing_interval: "month",
              product_id: "prod_THGlf0qL4IYiAD",
              tier: "pro",
            },
          },
          {
            isFeatured: true, // Highlight Yearly on pricing page
            priceId:
              process.env.NODE_ENV === "development"
                ? "price_1SKiFTDHoRr1ai9XCF5wywQO"
                : "price_1SKiFTDHoRr1ai9XCF5wywQO",

            name: "Unjuiced Pro – Yearly",
            description:
              "Get 2 months free when you commit annually. Unlock all premium features for a full year.",
            // Display price (UI only)
            price: 399.99,
            // Optional: show the 'equivalent monthly' as an anchor for comparison
            priceAnchor: 39.99, // communicates $39.99/mo equivalent
            features: [
              { name: "Everything in Pro – Monthly" },
              { name: "2 months free (save $79.98)" },
              { name: "Priority access to new features" },
            ],

            metadata: {
              billing_interval: "year",
              product_id: "prod_THGlf0qL4IYiAD",
              tier: "pro",
              promo: "2_months_free",
            },
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
    callbackUrl: "/arbitrage",
  },
} as ConfigProps;

export default config;