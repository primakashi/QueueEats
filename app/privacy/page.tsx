import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — Solusi Saji",
  description:
    "How Solusi Saji collects, uses, and protects information from restaurants, staff, and guests who use our platform.",
};

const EFFECTIVE_DATE = "17 July 2026";
const CONTACT_EMAIL = "halo@solusisaji.com";
const COMPANY = "Solusi Saji";

export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12 text-foreground">
      <header className="mb-10 border-b border-border pb-6">
        <p className="text-sm text-muted-foreground">
          <Link href="/" className="hover:underline">
            ← Back to home
          </Link>
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
          Privacy Policy
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Effective date: {EFFECTIVE_DATE}
        </p>
      </header>

      <div className="space-y-8 text-sm leading-6 sm:text-base sm:leading-7">
        <section>
          <p>
            This Privacy Policy describes how {COMPANY} (&quot;we&quot;,
            &quot;us&quot;, or &quot;our&quot;) collects, uses, discloses, and
            safeguards information when you use the Solusi Saji web and mobile
            applications and related services (collectively, the
            &quot;Service&quot;). By using the Service, you agree to the
            practices described in this policy.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold">1. Information We Collect</h2>
          <p className="mb-3">
            We collect information you provide directly, information generated
            when you use the Service, and information from third parties who
            help us operate the Service.
          </p>
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <strong>Account information.</strong> Name, email address, phone
              number, restaurant name, role (owner, cashier, kitchen, waiter,
              host, admin), and login credentials.
            </li>
            <li>
              <strong>Restaurant operations data.</strong> Menu items, prices,
              orders, tables, queue entries, receipts, and staff activity logs.
            </li>
            <li>
              <strong>Guest data.</strong> Guest name, phone number, party
              size, and order details submitted through queue, order, or
              payment flows.
            </li>
            <li>
              <strong>Payment data.</strong> Transaction amounts, payment
              status, and references. Card and bank credentials are handled by
              our payment processors; we do not store full card numbers.
            </li>
            <li>
              <strong>Device and usage data.</strong> IP address, device
              identifiers, browser type, operating system, pages viewed, and
              timestamps.
            </li>
            <li>
              <strong>Location data.</strong> Approximate location derived from
              IP address. Precise location is only collected if you explicitly
              enable it on your device.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold">2. How We Use Information</h2>
          <ul className="list-disc space-y-2 pl-6">
            <li>Provide, operate, and maintain the Service.</li>
            <li>
              Process orders, queues, payments, and other restaurant
              operations.
            </li>
            <li>
              Send transactional messages such as queue notifications, order
              status, receipts, and account alerts.
            </li>
            <li>Improve, personalize, and develop new features.</li>
            <li>
              Monitor usage, detect abuse, and protect the security of the
              Service.
            </li>
            <li>Comply with legal obligations.</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold">3. How We Share Information</h2>
          <p className="mb-3">
            We do not sell personal information. We share information only in
            these limited circumstances:
          </p>
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <strong>With the restaurant you interact with.</strong> Guest and
              order data is shared with the restaurant fulfilling your order
              or queue.
            </li>
            <li>
              <strong>Service providers.</strong> Hosting, database, analytics,
              messaging, and payment processors who act on our behalf under
              confidentiality obligations.
            </li>
            <li>
              <strong>Legal and safety.</strong> When required by law, legal
              process, or to protect the rights, property, or safety of {COMPANY},
              our users, or the public.
            </li>
            <li>
              <strong>Business transfers.</strong> In connection with a
              merger, acquisition, or sale of assets, subject to standard
              confidentiality protections.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold">4. Data Retention</h2>
          <p>
            We retain information for as long as your account is active or as
            needed to provide the Service, comply with legal obligations,
            resolve disputes, and enforce agreements. When information is no
            longer required, we delete or anonymize it.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold">5. Security</h2>
          <p>
            We use administrative, technical, and physical safeguards designed
            to protect information, including encrypted connections (HTTPS),
            role-based access controls, and hosted infrastructure with
            industry-standard protections. No method of transmission or
            storage is 100% secure; we cannot guarantee absolute security.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold">6. Your Rights</h2>
          <p className="mb-3">
            Depending on your jurisdiction, you may have the right to access,
            correct, delete, restrict processing of, or export your personal
            information, and to withdraw consent. To exercise these rights,
            contact us at{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-primary hover:underline"
            >
              {CONTACT_EMAIL}
            </a>
            . We will respond within a reasonable time and in accordance with
            applicable law.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold">7. Children&apos;s Privacy</h2>
          <p>
            The Service is not directed to children under 13, and we do not
            knowingly collect personal information from them. If you believe a
            child has provided us information, please contact us so we can
            delete it.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold">8. International Transfers</h2>
          <p>
            Your information may be processed in countries other than your
            own. Where required, we use appropriate safeguards for
            cross-border transfers.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold">9. Third-Party Services</h2>
          <p>
            The Service may link to or integrate with third-party services
            (for example, payment gateways or messaging providers). Their
            handling of your information is governed by their own privacy
            policies.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold">10. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. When we make
            material changes, we will update the effective date above and, if
            appropriate, provide additional notice through the Service.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold">11. Contact Us</h2>
          <p>
            If you have questions or concerns about this Privacy Policy or
            our data practices, contact us at{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-primary hover:underline"
            >
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </section>
      </div>

      <footer className="mt-12 border-t border-border pt-6 text-xs text-muted-foreground">
        © {new Date().getFullYear()} {COMPANY}. All rights reserved.
      </footer>
    </main>
  );
}
