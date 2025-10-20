"use client";
import React, { useState } from "react";
import { Container } from "./container";
import { Droplet, Mail } from "lucide-react";
import { Heading } from "./heading";
import { SubHeading } from "./subheading";
import { Input } from "./ui/input";
import { Button } from "./button";
import { toast } from "sonner";

export const Contact = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<"idle" | "success" | "error">("idle");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus("idle");

    // Store form reference before async operations
    const form = e.currentTarget;
    const formData = new FormData(form);
    const data = {
      name: formData.get("name"),
      email: formData.get("email"),
      message: formData.get("message"),
    };

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        setSubmitStatus("success");
        form.reset();
        toast.success("Message sent successfully! 📬", {
          description: "We'll get back to you within 24 hours.",
          duration: 5000,
        });
      } else {
        setSubmitStatus("error");
        const errorData = await response.json();
        toast.error("Failed to send message", {
          description: errorData.error || "Please try again later.",
          duration: 5000,
        });
      }
    } catch (error) {
      setSubmitStatus("error");
      toast.error("Failed to send message", {
        description: "Something went wrong. Please try again later.",
        duration: 5000,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Container className="min-h-[calc(100vh-8rem)] py-10 md:py-20">
      <div className="grid grid-cols-1 gap-10 px-4 md:grid-cols-2 md:px-8 lg:gap-40">
        <div>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand/10">
            <Droplet className="h-6 w-6 text-brand" />
          </div>
          <Heading className="mt-4 text-left lg:text-4xl">Get in Touch</Heading>
          <SubHeading as="p" className="mt-4 max-w-xl text-left">
            Have questions about odds comparison, arbitrage detection, or our platform? 
            We're here to help you find better odds.
          </SubHeading>
          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-6">
            <div>
              <label
                htmlFor="name"
                className="mb-2 block text-sm font-medium text-neutral-900 dark:text-neutral-100"
              >
                Name
              </label>
              <Input
                id="name"
                type="text"
                name="name"
                required
                placeholder="Your name"
                autoComplete="name"
              />
            </div>
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-sm font-medium text-neutral-900 dark:text-neutral-100"
              >
                Email
              </label>
              <Input
                id="email"
                type="email"
                name="email"
                required
                placeholder="your.email@example.com"
                autoComplete="email"
              />
            </div>
            <div>
              <label
                htmlFor="message"
                className="mb-2 block text-sm font-medium text-neutral-900 dark:text-neutral-100"
              >
                Message
              </label>
              <textarea
                id="message"
                name="message"
                required
                placeholder="Tell us how we can help..."
                rows={6}
                className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 transition-colors focus:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-200 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-neutral-700 dark:focus:ring-neutral-800"
              />
            </div>
            <Button 
              type="submit" 
              text={isSubmitting ? "Sending..." : "Send Message"}
              disabled={isSubmitting}
              loading={isSubmitting}
              variant="primary"
              className="h-10 w-full justify-center rounded-lg"
            />
          </form>
        </div>
        <ContactCard />
      </div>
    </Container>
  );
};

const ContactCard = () => {
  return (
    <div className="relative flex flex-col overflow-hidden rounded-3xl border border-neutral-200 bg-white p-8 dark:border-neutral-800 dark:bg-neutral-900">
      {/* Animated gradient background */}
      <div className="absolute inset-0 animate-gradient bg-[linear-gradient(45deg,var(--primary)_0%,var(--accent)_25%,var(--primary)_50%,var(--accent)_75%,var(--primary)_100%)] bg-[length:200%_200%] opacity-10"></div>
      
      {/* Dot pattern overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(var(--color-dots)_1px,transparent_1px)] [background-size:10px_10px] opacity-30"></div>
      
      <div className="relative z-10">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-sky-100 px-4 py-2 dark:bg-brand/10">
          <span className="text-sm font-medium text-sky-700 dark:text-brand">Support</span>
        </div>
        
        <h3 className="text-2xl font-bold text-neutral-900 dark:text-white">
          Quick Response Time
        </h3>
        <p className="mt-4 text-neutral-600 dark:text-neutral-300">
          We typically respond within 24 hours during business days. For urgent matters, 
          reach out to us on X for faster support.
        </p>
        
        <div className="mt-8 space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-100 dark:bg-brand/10">
              <Mail className="h-5 w-5 text-sky-700 dark:text-brand" />
            </div>
            <div>
              <p className="text-sm font-medium text-neutral-900 dark:text-white">Email</p>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">support@unjuiced.bet</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-100 dark:bg-brand/10">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 16 16" fill="currentColor" className="text-sky-700 dark:text-brand">
                <path d="M12.6.75h2.454l-5.36 6.142L16 15.25h-4.937l-3.867-5.07-4.425 5.07H.316l5.733-6.57L0 .75h5.063l3.495 4.633L12.601.75Zm-.86 13.028h1.36L4.323 2.145H2.865z"/>
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-neutral-900 dark:text-white">X</p>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">@unjuiced</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
