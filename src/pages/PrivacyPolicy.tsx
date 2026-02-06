import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { NavBarComponent } from '@/components/NavBarComponent';
import Footer from '@/components/Footer';
import { LEGAL_CONFIG } from '@/config/legalConfig';

const PrivacyPolicy = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <NavBarComponent />
      <main className="flex-1 container mx-auto px-4 py-12 max-w-4xl">
        <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-muted-foreground mb-8">Last updated: {LEGAL_CONFIG.lastUpdated}</p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-xl font-semibold mb-3">1. Introduction</h2>
            <p className="text-muted-foreground">
              Welcome to {LEGAL_CONFIG.companyName}. This Privacy Policy explains how we collect, use, and protect your personal information when you use our platform. By using {LEGAL_CONFIG.companyName}, you agree to the practices described in this policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. Information We Collect</h2>
            <p className="text-muted-foreground mb-2">We may collect the following types of information:</p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li><strong>Account Information:</strong> When you sign up using Google OAuth, we receive your name, email address, and profile picture.</li>
              <li><strong>User Content:</strong> Reviews, ratings, recommendations, posts, comments, and other content you create on the platform.</li>
              <li><strong>AI-Learned Preferences:</strong> Data derived from your interactions to personalize your experience, including taste profiles and recommendation preferences.</li>
              <li><strong>Usage Data:</strong> Information about how you interact with the platform, including pages visited, features used, and device information.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. Automated Processing and AI</h2>
            <p className="text-muted-foreground">
              Recommendations are generated using automated systems and may be based on user-submitted content and behavioral data. We do not guarantee that recommendations will be accurate, complete, or suitable for any specific purpose. These should not be considered professional, medical, legal, or financial advice.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. How We Use Your Information</h2>
            <p className="text-muted-foreground mb-2">We use the information we collect to:</p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>Provide, maintain, and improve the platform</li>
              <li>Personalize your experience and generate recommendations</li>
              <li>Communicate with you about your account or the platform</li>
              <li>Ensure the security and integrity of the platform</li>
              <li>Comply with legal obligations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. Data Sharing</h2>
            <p className="text-muted-foreground">
              We do not sell your personal data. We use third-party infrastructure providers such as cloud hosting, database services, and authentication services to operate the platform. These providers may process your data on our behalf in accordance with their own privacy policies.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. Data Security</h2>
            <p className="text-muted-foreground">
              We implement reasonable technical and organizational measures to protect user data. However, no method of transmission over the internet or electronic storage is completely secure, and we cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. Your Rights</h2>
            <p className="text-muted-foreground mb-2">You have the right to:</p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li><strong>Access your data:</strong> View the data we hold about you via the <Link to="/your-data" className="text-primary hover:underline">Your Data</Link> page.</li>
              <li><strong>Delete your account:</strong> You can delete your account from your account settings.</li>
              <li><strong>Export your data:</strong> Request a copy of your data by contacting us.</li>
              <li><strong>Contact us:</strong> Reach out to <a href={`mailto:${LEGAL_CONFIG.supportEmail}`} className="text-primary hover:underline">{LEGAL_CONFIG.supportEmail}</a> for any privacy-related requests.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8. Data Retention</h2>
            <p className="text-muted-foreground">
              We retain account data for up to 30 days after deletion to allow account recovery. After this period, data is scheduled for permanent deletion, subject to technical constraints and legal obligations.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">9. Data Deletion</h2>
            <p className="text-muted-foreground">
              You can delete your account and associated data at any time through your account settings. Alternatively, you can contact us at <a href={`mailto:${LEGAL_CONFIG.supportEmail}`} className="text-primary hover:underline">{LEGAL_CONFIG.supportEmail}</a> to request data deletion.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">10. International Users</h2>
            <p className="text-muted-foreground">
              If you access the platform from outside {LEGAL_CONFIG.jurisdiction}, you understand that your information may be processed and stored in {LEGAL_CONFIG.jurisdiction} or other countries where our service providers operate.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">11. Third-Party Links</h2>
            <p className="text-muted-foreground">
              The platform may contain links to third-party websites and services. We are not responsible for the privacy practices or content of these external sites. We encourage you to review their privacy policies before providing any personal information.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">12. Children's Privacy</h2>
            <p className="text-muted-foreground">
              The platform is not intended for children under the age of 13. If you are under the age of 18, you should use the platform under the supervision of a parent or legal guardian. If we become aware that we have collected personal information from a child under 13, we will take steps to delete that information.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">13. Changes to This Policy</h2>
            <p className="text-muted-foreground">
              We may update this policy from time to time. Continued use of the platform constitutes acceptance of the updated policy. We encourage you to review this page periodically for the latest information.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">14. Contact</h2>
            <p className="text-muted-foreground">
              If you have any questions about this Privacy Policy, please contact us at <a href={`mailto:${LEGAL_CONFIG.supportEmail}`} className="text-primary hover:underline">{LEGAL_CONFIG.supportEmail}</a>.
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default PrivacyPolicy;
