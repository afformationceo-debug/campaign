import type { Variants } from 'framer-motion';

// Page transition - subtle and fast (bkit style)
export const pageVariants: Variants = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
};

export const pageTransition = {
  duration: 0.2,
  ease: [0.4, 0, 0.2, 1],
};

// Stagger container - faster
export const staggerContainer: Variants = {
  animate: {
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.05,
    },
  },
};

// Fade up item
export const fadeUpItem: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.25, ease: [0.4, 0, 0.2, 1] } },
};

// Scale fade item
export const scaleFadeItem: Variants = {
  initial: { opacity: 0, scale: 0.97 },
  animate: { opacity: 1, scale: 1, transition: { duration: 0.2, ease: [0.4, 0, 0.2, 1] } },
};

// Slide in from right
export const slideInRight: Variants = {
  initial: { opacity: 0, x: 16 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.25, ease: [0.4, 0, 0.2, 1] } },
  exit: { opacity: 0, x: 16, transition: { duration: 0.15 } },
};
