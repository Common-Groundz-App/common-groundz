import React, { useEffect } from 'react';
import { NavBarComponent } from '@/components/NavBarComponent';
import Footer from '@/components/Footer';
import { LEGAL_CONFIG } from '@/config/legalConfig';

const CookiePolicy = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <NavBarComponent />
      <main className="flex-1 container mx-auto px-4 py-12 max-w-4xl">
        <h1 className="text-3xl font-bold mb-2">Cookie Policy</h1>
        <p className="text-muted-foreground mb-8">Last updated: {LEGAL_CONFIG.lastUpdated}</p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-xl font-semibold mb-3">1. What Are Cookies</h2>
            <p className="text-muted-foreground">
              Cookies are small text files stored on your device when you visit a website. They help the website remember your preferences and improve your browsing experience. {LEGAL_CONFIG.companyName} uses cookies to ensure the platform functions correctly and to enhance your experience.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. Strictly Necessary Cookies</h2>
            <p className="text-muted-foreground">
              These cookies are essential for the platform to function and cannot be disabled. They include authentication session cookies (via Supabase) and security cookies. These do not require your consent as they are necessary for the operation of the platform.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. Preference Cookies</h2>
            <p className="text-muted-foreground">
              These cookies remember your settings such as theme preferences (light or dark mode). They enhance your experience but are not essential for the platform to function.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. Third-Party Cookies</h2>
            <p className="text-muted-foreground">
              When you sign in using Google OAuth, Google may set cookies on your device in accordance with their own privacy and cookie policies. We recommend reviewing Google's privacy policy for more information about how they use cookies.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. Future Changes</h2>
            <p className="text-muted-foreground">
              If advertising, analytics, or other optional cookie categories are introduced in the future, this policy will be updated accordingly and appropriate consent mechanisms will be provided before any optional cookies are set.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. Managing Cookies</h2>
            <p className="text-muted-foreground mb-2">
              You can manage or delete cookies through your browser settings. Please note that disabling essential cookies may affect the functionality of the platform. Most browsers allow you to:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>View what cookies are stored on your device</li>
              <li>Delete individual or all cookies</li>
              <li>Block cookies from specific or all websites</li>
              <li>Set preferences for cookie acceptance</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. Updates to This Policy</h2>
            <p className="text-muted-foreground">
              We may update this Cookie Policy from time to time to reflect changes in our practices or applicable laws. We encourage you to review this page periodically for the latest information.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8. Contact</h2>
            <p className="text-muted-foreground">
              If you have any questions about this Cookie Policy, please contact us at <a href={`mailto:${LEGAL_CONFIG.supportEmail}`} className="text-primary hover:underline">{LEGAL_CONFIG.supportEmail}</a>.
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default CookiePolicy;
