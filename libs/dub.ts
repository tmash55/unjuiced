import { Dub } from "dub";

// Initialize Dub client
// Make sure to set DUB_API_KEY in your environment variables
export const dub = new Dub({
  token: process.env.DUB_API_KEY,
});

