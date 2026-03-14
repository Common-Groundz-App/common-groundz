

# Add Brand Logo to AuthPromptModal

Based on the memory about branding (`auth-prompt-modal-identity`), the modal should have:
1. A **2px `bg-brand-orange/80` top accent bar**
2. A **centered brand Logo** (`h-6`) above the title

## Change — `src/components/auth/AuthPromptModal.tsx`

1. **Import** `Logo` from `@/components/Logo`
2. **Add accent bar** as the first child inside `AlertDialogPrimitive.Content`: `<div className="h-[2px] bg-brand-orange/80 w-full" />`
3. **Add Logo** inside the content div, before the title: `<Logo size="sm" className="h-6" />`

The content div padding adjusts slightly (`pt-6` instead of `pt-8`) since the logo provides visual spacing.

