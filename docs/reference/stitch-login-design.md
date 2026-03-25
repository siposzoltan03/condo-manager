# Stitch Login Screen Design Reference

## Key Design Elements

- **Font:** Manrope (headlines), Inter (body/labels)
- **Color scheme:** Deep navy primary (#002045), slate secondaries, light surface backgrounds
- **Background:** Mesh gradient with subtle architectural SVG illustration (apartment buildings, very low opacity)
- **Card:** White card, max-w-md, rounded-xl, soft shadow, 10px padding
- **Header text:** "Resident Portal" (font-headline, 3xl, extrabold, primary color), subtitle "Welcome back. Please enter your credentials to manage your property."
- **Top bar:** "Condo Manager" branding left, "English / Magyar" language switcher right (with globe icon)
- **Email field:** Label "EMAIL ADDRESS" (uppercase, xs, semibold, tracking-wider), input with mail icon right-aligned, bg-surface-container-low, rounded-lg, py-4 px-5
- **Password field:** Label "PASSWORD" with "Forgot password?" link inline-right, input with lock icon, same styling
- **Sign In button:** Full width, bg-primary, text-on-primary, font-bold, py-4, rounded-lg, shadow
- **Footer text:** "Not a registered resident? Contact your manager"
- **Page footer:** Copyright, Privacy Policy, Terms, Contact Support links
- **Security badge:** Small shield icon + "Enterprise Grade Security" text below card

## Tailwind Color Tokens (from Stitch config)

```
primary: "#002045"
primary-container: "#1a365d"
surface-bright: "#faf8ff"
surface-container-low: "#f2f3ff"
surface-container-lowest: "#ffffff"
on-surface: "#131b2e"
on-surface-variant: "#43474e"
secondary: "#515f74"
outline-variant: "#c4c6cf"
surface-tint: "#455f88"
error: "#ba1a1a"
```
