import { Dub } from "dub";

// Initialize Dub client
// Make sure to set DUB_API_KEY in your environment variables
if (!process.env.DUB_API_KEY) {
  console.warn('⚠️ DUB_API_KEY is not set - lead/sale tracking will not work');
}

export const dub = new Dub({
  token: process.env.DUB_API_KEY || '',
});

