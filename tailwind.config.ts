
import type { Config } from "tailwindcss";

export default {
	darkMode: ["class"],
	content: [
		"./pages/**/*.{ts,tsx}",
		"./components/**/*.{ts,tsx}",
		"./app/**/*.{ts,tsx}",
		"./src/**/*.{ts,tsx}",
	],
	prefix: "",
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: {
				'2xl': '1400px'
			}
		},
		extend: {
			colors: {
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))'
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))'
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))'
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))'
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
				},
				sidebar: {
					DEFAULT: 'hsl(var(--sidebar-background))',
					foreground: 'hsl(var(--sidebar-foreground))',
					primary: 'hsl(var(--sidebar-primary))',
					'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
					accent: 'hsl(var(--sidebar-accent))',
					'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
					border: 'hsl(var(--sidebar-border))',
					ring: 'hsl(var(--sidebar-ring))'
				},
				brand: {
					orange: 'hsl(var(--brand-orange))',
					blue: "#0EA5E9",
					teal: "#14B8A6"
				}
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)'
			},
			aspectRatio: {
				'4/5': '4 / 5',
				'3/4': '3 / 4',
				'3/2': '3 / 2',
				'9/16': '9 / 16',
			},
			keyframes: {
				'accordion-down': {
					from: {
						height: '0'
					},
					to: {
						height: 'var(--radix-accordion-content-height)'
					}
				},
				'accordion-up': {
					from: {
						height: 'var(--radix-accordion-content-height)'
					},
					to: {
						height: '0'
					}
				},
				'fade-in': {
					'0%': {
						opacity: '0',
						transform: 'translateY(10px)'
					},
					'100%': {
						opacity: '1',
						transform: 'translateY(0)'
					}
				}
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out',
				'fade-in': 'fade-in 0.5s ease-out'
			}
		}
	},
	plugins: [
		require("tailwindcss-animate"),
		function({ addUtilities }: { addUtilities: Function }) {
			const newUtilities = {
				// Twitter-style layouts for media grid with object-contain
				'.twitter-media-single': {
					width: '100%',
					maxWidth: '100%',
					borderRadius: '0.75rem',
					overflow: 'hidden',
					display: 'flex',
					justifyContent: 'center',
					alignItems: 'center',
					position: 'relative',
					'& > *': {
						objectFit: 'contain',
						maxHeight: '100%',
						maxWidth: '100%'
					}
				},
				'.twitter-media-two': {
					width: '100%',
					display: 'grid',
					gridTemplateColumns: 'repeat(2, 1fr)',
					gap: '2px',
					borderRadius: '0.75rem',
					overflow: 'hidden',
					'& > *': {
						aspectRatio: '1 / 1',
						objectFit: 'contain',
						display: 'flex',
						justifyContent: 'center',
						alignItems: 'center'
					}
				},
				'.twitter-media-three': {
					width: '100%',
					display: 'grid',
					gridTemplateColumns: '1fr 1fr',
					gridTemplateRows: '1fr 1fr',
					gap: '2px',
					borderRadius: '0.75rem',
					overflow: 'hidden',
					'& > *': {
						aspectRatio: '1 / 1',
						objectFit: 'contain',
						display: 'flex',
						justifyContent: 'center',
						alignItems: 'center'
					},
					'& > *:first-child': {
						gridRow: 'span 2',
						height: '100%'
					}
				},
				'.twitter-media-four': {
					width: '100%',
					display: 'grid',
					gridTemplateColumns: 'repeat(2, 1fr)',
					gridTemplateRows: 'repeat(2, 1fr)',
					gap: '2px',
					borderRadius: '0.75rem',
					overflow: 'hidden',
					'& > *': {
						aspectRatio: '1 / 1',
						objectFit: 'contain',
						display: 'flex',
						justifyContent: 'center',
						alignItems: 'center'
					}
				},
				
				// LinkedIn-style layouts - revised with better orientation handling
				'.linkedin-media-two': {
					width: '100%',
					display: 'grid',
					gridTemplateColumns: '1fr',
					gridTemplateRows: 'auto auto',
					gap: '3px',
					borderRadius: '0.75rem',
					overflow: 'hidden',
					'& > .first-media-item': {
						height: '300px',
						minHeight: '300px',
					},
					'& > *:not(.first-media-item)': {
						height: '200px',
						minHeight: '200px',
					}
				},
				'.linkedin-media-three': {
					width: '100%',
					display: 'grid',
					gridTemplateColumns: '1fr 1fr',
					gridTemplateRows: 'auto auto',
					gap: '3px',
					borderRadius: '0.75rem',
					overflow: 'hidden',
					'& > .first-media-item': {
						gridColumn: 'span 2',
						height: '280px',
						minHeight: '280px',
					},
					'& > *:not(.first-media-item)': {
						height: '160px',
						minHeight: '160px',
					}
				},
				'.linkedin-media-four': {
					width: '100%',
					display: 'grid',
					gridTemplateColumns: '1fr 1fr',
					gridTemplateRows: 'auto auto auto',
					gap: '3px',
					borderRadius: '0.75rem',
					overflow: 'hidden',
					'& > .first-media-item': {
						gridColumn: 'span 2',
						height: '240px',
						minHeight: '240px',
					},
					'& > *:not(.first-media-item)': {
						height: '120px',
						minHeight: '120px',
					}
				},
				
				// Revised orientation-specific LinkedIn layouts
				'.linkedin-portrait-first': {
					width: '100%',
					display: 'grid',
					gridTemplateColumns: '1fr 1fr',
					gridTemplateRows: 'minmax(380px, 1fr) minmax(190px, 0.5fr)',
					gap: '3px',
					borderRadius: '0.75rem',
					overflow: 'hidden',
					'& > .first-media-item': {
						gridRow: 'span 2',
						minHeight: '380px',
						height: '100%',
					},
					'& > *:not(.first-media-item)': {
						minHeight: '190px',
						height: '190px',
					}
				},
				'.linkedin-landscape-first': {
					width: '100%',
					display: 'grid',
					gridTemplateColumns: '1fr 1fr',
					gridTemplateRows: 'minmax(300px, auto) minmax(175px, auto)',
					gap: '3px',
					borderRadius: '0.75rem',
					overflow: 'hidden',
					'& > .first-media-item': {
						gridColumn: 'span 2',
						minHeight: '300px',
						height: '300px',
					},
					'& > *:not(.first-media-item)': {
						minHeight: '175px',
						height: '175px',
					}
				},
				
				// Improved overlay for +more images
				'.media-more-overlay': {
					position: 'absolute', 
					inset: '0',
					backgroundColor: 'rgba(0,0,0,0.7)',
					display: 'flex',
					flexDirection: 'column',
					alignItems: 'center',
					justifyContent: 'center',
					color: 'white',
					fontSize: '1.25rem',
					fontWeight: '600',
					transition: 'all 0.2s ease',
					'&:hover': {
						backgroundColor: 'rgba(0,0,0,0.8)',
					}
				},
				
				// Smart media containers that adapt to image orientation
				'.media-container-portrait': {
					maxWidth: '80%',
					margin: '0 auto',
					display: 'flex',
					justifyContent: 'center',
					alignItems: 'center',
					height: '100%',
					'& img, & video': {
						maxWidth: '100%',
						maxHeight: '100%',
						objectFit: 'contain'
					}
				},
				'.media-container-landscape': {
					width: '100%',
					display: 'flex',
					justifyContent: 'center',
					alignItems: 'center',
					height: '100%',
					'& img, & video': {
						maxWidth: '100%',
						maxHeight: '100%',
						objectFit: 'contain'
					}
				},
				'.media-container-square': {
					maxWidth: '85%',
					margin: '0 auto',
					display: 'flex',
					justifyContent: 'center',
					alignItems: 'center',
					height: '100%',
					'& img, & video': {
						maxWidth: '100%',
						maxHeight: '100%',
						objectFit: 'contain'
					}
				},
				// Additional utility for media containers
				'.media-container': {
					display: 'flex',
					justifyContent: 'center',
					alignItems: 'center',
					overflow: 'hidden',
					position: 'relative',
					'& img, & video': {
						maxWidth: '100%',
						maxHeight: '100%',
						objectFit: 'contain'
					}
				},
				// Improved image preview utilities
				'.lightbox-image': {
					maxWidth: '100%',
					maxHeight: '90vh',
					margin: '0 auto',
					display: 'block',
				},
				'.preview-navigation': {
					position: 'absolute',
					top: '50%',
					transform: 'translateY(-50%)',
					width: '40px',
					height: '40px',
					borderRadius: '50%',
					backgroundColor: 'rgba(0,0,0,0.5)',
					color: 'white',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					cursor: 'pointer',
					zIndex: '50',
					transition: 'all 0.2s ease',
					'&:hover': {
						backgroundColor: 'rgba(0,0,0,0.8)',
					}
				}
			};
			addUtilities(newUtilities);
		},
	],
} satisfies Config;
