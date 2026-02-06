import React, { useEffect } from 'react';
import { NavBarComponent } from '@/components/NavBarComponent';
import Footer from '@/components/Footer';
import { LEGAL_CONFIG } from '@/config/legalConfig';

const TermsOfService = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <NavBarComponent />
      <main className="flex-1 container mx-auto px-4 py-12 max-w-4xl">
        <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
        <p className="text-muted-foreground mb-8">Last updated: {LEGAL_CONFIG.lastUpdated}</p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-xl font-semibold mb-3">1. Acceptance of Terms</h2>
            <p className="text-muted-foreground">
              By accessing or using {LEGAL_CONFIG.companyName}, you agree to be bound by these Terms of Service. If you do not agree to these Terms, you may not use the platform.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. Eligibility</h2>
            <p className="text-muted-foreground">
              You must be at least 13 years of age to use the platform. If you are under the age of 18, you should use the platform under the supervision of a parent or legal guardian.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. Account Registration</h2>
            <p className="text-muted-foreground">
              You may be required to create an account to access certain features. You are responsible for maintaining the confidentiality of your account credentials and for all activity that occurs under your account.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. User Content</h2>
            <p className="text-muted-foreground mb-2">
              You retain ownership of the content you create on the platform, including reviews, ratings, recommendations, and posts. By posting content, you grant {LEGAL_CONFIG.companyName} a non-exclusive, worldwide, royalty-free license to display, distribute, and promote your content on the platform.
            </p>
            <p className="text-muted-foreground">
              You are solely responsible for the content you post, including reviews, ratings, and recommendations. You represent that your content does not violate any laws or third-party rights.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. Prohibited Conduct</h2>
            <p className="text-muted-foreground mb-2">You agree not to:</p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>Post false, misleading, defamatory, or fraudulent content</li>
              <li>Harass, abuse, or threaten other users</li>
              <li>Use the platform for any unlawful purpose</li>
              <li>Attempt to gain unauthorized access to the platform or its systems</li>
              <li>Use bots, scrapers, crawlers, or automated means to access, collect, or index content from the platform without our prior written consent</li>
              <li>Impersonate any person or entity</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. Content Moderation</h2>
            <p className="text-muted-foreground">
              We reserve the right to remove content or suspend accounts that violate our policies, at our sole discretion, with or without notice.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. No Professional Advice</h2>
            <p className="text-muted-foreground">
              All content on the platform, including AI-generated recommendations, is provided for informational purposes only. {LEGAL_CONFIG.companyName} does not provide professional, medical, legal, or financial advice. We do not guarantee the accuracy, completeness, or reliability of any content or recommendation on the platform.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8. User Responsibility for Decisions</h2>
            <p className="text-muted-foreground">
              You acknowledge that any decisions you make based on content or recommendations on the platform are made at your own risk. {LEGAL_CONFIG.companyName} is not liable for any outcomes resulting from your reliance on platform content.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">9. Platform Role</h2>
            <p className="text-muted-foreground">
              {LEGAL_CONFIG.companyName} is a discovery and recommendation platform. We do not manufacture, sell, distribute, or control the products, services, or businesses listed on the platform. Any transaction or interaction with third parties is solely between you and the relevant third party.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">10. No Endorsement and Commercial Relationships</h2>
            <p className="text-muted-foreground">
              The inclusion of any product, service, place, or recommendation on the platform does not constitute an endorsement or guarantee by {LEGAL_CONFIG.companyName}. Some listings, recommendations, or content on the platform may be influenced by partnerships, sponsorships, affiliate relationships, or commercial arrangements. Where applicable, such relationships will be disclosed in accordance with applicable law.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">11. Third-Party Links and Services</h2>
            <p className="text-muted-foreground">
              The platform may contain links to third-party websites and services. We are not responsible for the content, privacy practices, or availability of these external sites. Your use of third-party services is at your own risk.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">12. Intellectual Property</h2>
            <p className="text-muted-foreground">
              The platform, its design, features, and original content (excluding user-generated content) are the property of {LEGAL_CONFIG.companyName} and are protected by applicable intellectual property laws. You may not copy, modify, or distribute any part of the platform without our prior written consent.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">13. Indemnification</h2>
            <p className="text-muted-foreground">
              You agree to indemnify and hold harmless {LEGAL_CONFIG.companyName}, its founders, and affiliates from any claims, damages, or expenses arising from your use of the platform, your content, or your violation of these Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">14. Disclaimers</h2>
            <p className="text-muted-foreground">
              The platform is provided on an "as is" and "as available" basis. We do not guarantee that the platform will be uninterrupted, secure, or error-free. We disclaim all warranties, express or implied, to the fullest extent permitted by law.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">15. Limitation of Liability</h2>
            <p className="text-muted-foreground">
              To the fullest extent permitted by law, our maximum liability is limited to the amount paid by you (if any) in the last 12 months. We are not liable for any indirect, incidental, consequential, or punitive damages, including loss of profits, data, goodwill, or business interruption.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">16. Modification of Service</h2>
            <p className="text-muted-foreground">
              We reserve the right to modify, suspend, or discontinue any part of the platform at any time without liability.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">17. Termination</h2>
            <p className="text-muted-foreground">
              We may suspend or terminate your account at any time for violation of these Terms or for any other reason at our sole discretion. You may delete your account at any time through your account settings.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">18. Changes to Terms</h2>
            <p className="text-muted-foreground">
              We may update these Terms from time to time. Continued use of the platform constitutes acceptance of the updated Terms. We encourage you to review this page periodically.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">19. Governing Law</h2>
            <p className="text-muted-foreground">
              These Terms are governed by the laws of {LEGAL_CONFIG.jurisdiction}. Any disputes arising from these Terms or your use of the platform shall be subject to the exclusive jurisdiction of the courts in Bangalore, Karnataka.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">20. Contact</h2>
            <p className="text-muted-foreground">
              If you have any questions about these Terms of Service, please contact us at <a href={`mailto:${LEGAL_CONFIG.supportEmail}`} className="text-primary hover:underline">{LEGAL_CONFIG.supportEmail}</a>.
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default TermsOfService;
