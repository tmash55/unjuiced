# Supabase Email Setup Guide

The 500 error you're seeing is because Supabase's email service needs to be configured in your dashboard.

## Steps to Fix Password Reset Emails:

### 1. Enable Email Auth in Supabase Dashboard

1. Go to https://supabase.com/dashboard
2. Select your project: `mcnbnrpaqretktdiglqd`
3. Navigate to **Authentication** → **Providers**
4. Make sure **Email** is enabled

### 2. Configure Email Templates

1. Go to **Authentication** → **Email Templates**
2. Find the **"Reset Password"** template
3. Make sure it's enabled
4. You can customize the template if needed (optional)

### 3. Set Up Redirect URLs

1. Go to **Authentication** → **URL Configuration**
2. Under **Redirect URLs**, add:
   ```
   http://localhost:3000/**
   http://localhost:3000/forgot-password
   ```
3. When you deploy to production, add your production URLs:
   ```
   https://yourdomain.com/**
   https://yourdomain.com/forgot-password
   ```

### 4. Configure SMTP (Optional but Recommended for Production)

By default, Supabase uses their own email service, but for production you should use your own SMTP:

1. Go to **Project Settings** → **Auth** → **SMTP Settings**
2. Enable **Custom SMTP**
3. Add your SMTP credentials (e.g., from SendGrid, AWS SES, Resend, etc.)

Example for Resend:
- Host: `smtp.resend.com`
- Port: `465` or `587`
- Username: `resend`
- Password: Your Resend API key

### 5. Test the Flow

1. Go to `/forgot-password` on your app
2. Enter an email address that exists in your Supabase auth users
3. Check your email inbox (and spam folder)
4. Click the reset link
5. You should be redirected back to `/forgot-password` where you can set a new password

## Troubleshooting

### Still getting 500 errors?

1. Check Supabase logs: **Logs** → **Auth Logs** in your dashboard
2. Make sure the email address you're testing with exists in your Auth users
3. Check your browser console for any additional error messages
4. Verify your `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are correct in `.env.local`

### Email not arriving?

1. Check spam folder
2. Verify SMTP is configured (if using custom SMTP)
3. Check Supabase email rate limits (free tier has limits)
4. Look at Auth Logs in Supabase dashboard for email delivery status

## Current Setup

Your forgot password flow:
- Request reset → User enters email → Supabase sends email with magic link
- Click link → Redirects to `/forgot-password` with session → Shows password reset form
- Submit new password → Updates password → Redirects to `/login`

