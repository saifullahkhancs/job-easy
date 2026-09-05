/**
 * Terms of Service copy for the public /terms page.
 *
 * The content lives here (and NOT inside LegalPage.jsx) so the page component
 * stays a pure renderer: it derives the table of contents, section numbering
 * and "see also" links straight from this module. Keep `id` stable — it is
 * used for deep links such as /terms#ai-matching.
 *
 * Written to match how Job Easy actually works today (see core/config.py,
 * core/email.py, api/v1/*): free beta, role-based access, applications sent
 * from the shared platform address via Resend (own-mailbox sending is not live
 * yet, so the clauses covering it are written conditionally), and AI matching
 * on shared free-tier provider keys. If a limit or flow changes, update the
 * copy here — and re-read the "sending-email" section when own-mailbox
 * sending ships.
 */
const CONTACT_EMAIL = "info@jobeasy.online";

export const termsDoc = {
  key: "terms",
  path: "/terms",
  kicker: "Legal",
  title: "Terms of Service",
  heading: "Terms of Service",
  subtitle:
    "The agreement between you and Job Easy when you create an account, browse templates, or send a job application through us.",
  updated: "6 September 2026",
  related: { path: "/privacy", label: "Privacy Policy" },
  note:
    "Job Easy is in early beta and these documents are a working draft written for clarity, not legal advice. " +
    "Fill in the operator name and mailing address, and have a lawyer in your jurisdiction review both pages before you rely on them publicly.",
  sections: [
    {
      id: "acceptance",
      title: "Acceptance of these terms",
      body: (
        <>
          <p>
            By creating a Job Easy account, using the app at{" "}
            <strong>jobeasy.online</strong>, or sending an application through it, you agree to
            these Terms of Service and to our <a href="/privacy">Privacy Policy</a>, which is part
            of this agreement. If you are accepting on behalf of a company or another person, you
            confirm that you are allowed to bind them.
          </p>
          <p>
            If you do not agree, please do not create an account or send anything through the
            service — and if you already have one, asking us to delete it is always available to
            you.
          </p>
        </>
      ),
    },
    {
      id: "what-job-easy-is",
      title: "What Job Easy is (and is not)",
      body: (
        <>
          <p>
            Job Easy is a tool for preparing and sending job applications. You upload a CV once,
            keep a small library of cover-letter templates, attach a recruiter's job description,
            and send the resulting email — with your CV attached — through the Job Easy sending
            address.
            On top of that we offer shared default templates, a personal-template library, an
            access-request and approval workflow, and an AI matcher that suggests which of your
            templates fits a posting best.
          </p>
          <p>We are not a party to the applications you send. Specifically, Job Easy is:</p>
          <ul className="legal-list">
            <li>
              <strong>not</strong> your mailbox provider — in today's beta, applications leave from
              the shared Job Easy sending address (see{" "}
              <a href="#sending-email">Sending email through Job Easy</a>), subject to that
              provider's daily quota;
            </li>
            <li>
              <strong>not</strong> a guarantee of anything: no interviews, no replies, no delivery,
              and no outcome of any application.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: "your-account",
      title: "Your account",
      body: (
        <>
          <p>
            You must give us accurate information, keep your password safe, and tell us promptly
            at <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> if you believe your account
            has been accessed by someone else. Your email address is your account identifier in our
            system, so one account per address.
          </p>
          <p>
            You are responsible for everything that happens under your account, including every
            application sent with it. If you later connect your own mailbox, you can disconnect it
            in the app and revoke the app password inside your email provider — that stops Job Easy
            from sending on your behalf immediately.
          </p>
          <p>
            Accounts are for individuals. Do not share your login, and do not create accounts to
            get around a limit, a suspension, or a decision we made about an access request.
          </p>
        </>
      ),
    },
    {
      id: "access-tiers-and-limits",
      title: "Access tiers, roles and limits",
      body: (
        <>
          <p>
            Job Easy currently runs three roles, and what you can do depends on which one you
            have:
          </p>
          <ul className="legal-list">
            <li>
              <strong>Visitor</strong> — browse the shared default templates and request access. A
              request is reviewed by our team; we aim to answer within 24 hours but we do not
              promise it.
            </li>
            <li>
              <strong>Customer</strong> — create and manage your own templates and send
              applications. The free beta currently allows up to{" "}
              <strong>2 personal templates</strong> per account.
            </li>
            <li>
              <strong>Admin</strong> — staff who review access requests, manage users, and curate
              the shared default templates.
            </li>
          </ul>
          <p>
            The AI matcher is capped at <strong>20 runs per account per day</strong> (reset at
            midnight UTC) because it runs on shared free-tier API keys that the whole service
            splits. Each pasted job description must be between 120 and 4,000 characters. The API
            as a whole is rate limited to about 100 requests per minute per client.
          </p>
          <p>
            Limits are there to keep the service usable for everyone. We can change them — or the
            pricing model, if we ever introduce paid plans — and we will publish the current values
            in the app rather than send you a new contract each time.
          </p>
        </>
      ),
    },
    {
      id: "sending-email",
      title: "Sending email through Job Easy",
      body: (
        <>
          <p>
            Right now the beta sends from our own verified address —{" "}
            <strong>info@jobeasy.online</strong>, delivered through Resend's free tier — with{" "}
            <em>your</em> chosen display name on it. We do not connect to your inbox, read incoming
            mail, or touch your mailbox history. Two consequences you should plan around:</p>
          <ul className="legal-list">
            <li>
              a recruiter who hits Reply answers the Job Easy address, not yours — so put a phone
              number or the email you actually check inside the letter itself;
            </li>
            <li>
              the shared sender has a daily quota, so sending can be delayed or briefly unavailable
              when it runs out. That is a capacity limit, not a delivery promise.
            </li>
          </ul>
          <p>
            When sending from your own Gmail or your own Resend account is switched on, it works
            like this: you give us a sender address, display name, and an app password; we store
            that password encrypted and use it only to hand over the messages you ask us to send.
            You can revoke it inside your email provider at any time, which stops our access
            immediately.
          </p>
          <p>Either way, the message is yours. In particular you agree:</p>
          <ul className="legal-list">
            <li>
              to send only genuine applications and messages you are entitled to send, to addresses
              you have a reason to contact;
            </li>
            <li>
              never to use the service for unsolicited bulk email, phishing, scams, pyramid or
              investment schemes, or offers of employment you are not authorised to make;
            </li>
            <li>not to impersonate a person or company, or falsify sender details and attachments;</li>
            <li>
              to respect unsubscribe and opt-out requests, and to keep the contact details in your
              templates current and accurate;
            </li>
            <li>
              if you connect your own mailbox later, to stay inside your provider's sending rules —
              high volume or poor-quality mail can get a mailbox throttled or closed, and that is
              between you and your provider.
            </li>
          </ul>
          <p>
            Because today's beta shares one sending address between all users, misuse by anyone is
            felt by everyone. To protect that reputation and deliverability, we may throttle, hold,
            or block messages that look automated at scale, malformed, or abusive, and we may limit
            an account while we check.
          </p>
        </>
      ),
    },
    {
      id: "your-content",
      title: "Your content stays yours",
      body: (
        <>
          <p>
            The CVs, cover letters, template text, and job descriptions you put into Job Easy
            belong to you. We do not sell them, publish them, or licence them on to anyone else.
          </p>
          <p>
            You give us a limited permission to work with them — only as much as running the
            service needs: storing them, rendering them, attaching them to the emails you send, and
            sending the relevant text to an AI provider when you ask for a match.
          </p>
          <p>
            You confirm that you have the right to upload what you do, including any third-party
            text, and that your templates and CV do not contain other people's personal data or
            confidential material that you have no basis to share.
          </p>
          <p>
            One exception is worth reading: if a template of yours is{" "}
            <strong>promoted to a shared default</strong> by an admin, it becomes visible to other
            users as a template they can send. That only happens on your request or with your
            agreement, and you keep ownership — you are granting everyone who uses it the same
            licence you granted us.
          </p>
        </>
      ),
    },
    {
      id: "ai-matching",
      title: "AI matching is advice, not a decision",
      body: (
        <>
          <p>
            Match Template reads a job description, scores your templates from 0 to 100, and gives a
            short reason for the ranking. It is generated by third-party language models on
            free-tier keys, so it can be wrong, shallow, or occasionally unfair — model output
            inherits the biases of what it was trained on.
          </p>
          <ul className="legal-list">
            <li>Treat scores as a suggestion. The final choice, and the sent email, are yours.</li>
            <li>
              Check the subject line, body, and attachment before sending. Everything we generate
              is an editable draft, not an approved document.
            </li>
            <li>
              Do not paste sensitive personal data about other people into the job-description
              field.
            </li>
            <li>
              AI runs are optional; templates, uploads, and sending all work without them.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: "acceptable-use",
      title: "Acceptable use",
      body: (
        <>
          <p>You agree not to use Job Easy to do, or help others do, any of the following:</p>
          <ul className="legal-list">
            <li>break a law or a court order, or infringe someone's rights;</li>
            <li>
              send spam, deceptive mail, malware, or content that is unlawful, hateful, harassing,
              or sexually exploitative;
            </li>
            <li>
              attack the service: overload it, probe it for weaknesses, evade rate limits, scrape
              other users' data or templates, or reverse-engineer it where that is prohibited;
            </li>
            <li>
              upload files designed to disrupt it, or use the upload fields to host content that is
              not yours to host;
            </li>
            <li>
              resell or white-label the service, or offer it to third parties as your own product,
              without our written permission.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: "intellectual-property",
      title: "Our intellectual property",
      body: (
        <>
          <p>
            The app itself — design, code, layout, the "Job Easy" name and logo — belongs to us and
            is protected. You get a personal, non-transferable, revocable right to use it while
            these terms apply. That is all: no other rights are granted.
          </p>
          <p>
            If you send us feedback, ideas, or bug reports, we may use them without owing you
            anything, and we will not attribute them to you unless you ask us to.
          </p>
        </>
      ),
    },
    {
      id: "beta-and-fees",
      title: "Beta status and fees",
      body: (
        <>
          <p>
            Job Easy is an early beta. Features appear, move, and sometimes disappear; things may
            break. Some numbers on the marketing site are labelled as demo placeholders — they are
            illustrations, not measured statistics, and they are marked wherever they appear.
          </p>
          <p>
            Using the service is free right now. If we introduce paid plans, the price, billing,
            and cancellation terms for those plans will be published where you buy them and will
            be added to this agreement.
          </p>
        </>
      ),
    },
    {
      id: "suspension-termination",
      title: "Suspension and termination",
      body: (
        <>
          <p>
            You can stop at any time: delete your templates, remove your sending setup, and email{" "}
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> from your registered address to
            ask us to close your account. We will delete it, and the data in it, within 30 days
            apart from anything we must legally keep or that still sits in provider backups.
          </p>
          <p>
            We may suspend or end access if you break these terms, if your account is being abused
            or appears compromised, if continuing would expose us or other users to risk, or if the
            law requires it. Where we reasonably can, we will tell you why and give you a chance to
            fix it first. You can always get a copy of your own templates and CVs before deleting.
          </p>
        </>
      ),
    },
    {
      id: "third-parties",
      title: "Third-party services",
      body: (
        <p>
          Parts of the service run on other companies' platforms: hosting and database, Resend for
          transactional email, your own email provider for sending, AI providers (Google Gemini,
          Groq, or OpenRouter) for matching, and Vercel for analytics. Each of them has its own
          terms and privacy practices, listed in our{" "}
          <a href="/privacy">Privacy Policy</a>. We are responsible for choosing them
          reasonably, but we cannot control how they operate.
        </p>
      ),
    },
    {
      id: "disclaimer",
      title: "Disclaimer",
      body: (
        <p>
          The service is provided <strong>"as is" and "as available"</strong>. To the fullest extent
          the law allows, we give no warranties — express or implied — about the service, its
          accuracy, its fitness for a purpose, its uninterrupted availability, the security of
          transmitted email, or any result you hope for. You are responsible for the content and
          consequences of the applications you send.
        </p>
      ),
    },
    {
      id: "liability",
      title: "Limitation of liability",
      body: (
        <>
          <p>
            Nothing here excludes liability that cannot lawfully be excluded — such as for fraud or
            death or personal injury caused by our negligence. Subject to that, and to the fullest
            extent the law allows:
          </p>
          <ul className="legal-list">
            <li>
              we are not liable for indirect, incidental, special, consequential, exemplary losses,
              or for lost profits, lost opportunities, lost data, suspended mailboxes, or damage
              to your sender reputation;
            </li>
            <li>
              our total liability arising from the service is capped at the greater of what you have
              paid us in the 12 months before the claim, or <strong>USD 100</strong> if you have
              not paid us anything;
            </li>
            <li>
              claims about an act or omission must be brought within 12 months of when they arose.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: "indemnity",
      title: "If someone complains because of what you sent",
      body: (
        <p>
          You agree to cover our reasonable costs and losses if a third party brings a claim against
          us because of your content, the emails you send through the service, or your breach of
          these terms or of someone else's rights. Tell us as soon as you receive such a claim, and
          let us handle it where we can.
        </p>
      ),
    },
    {
      id: "changes",
      title: "Changes to these terms",
      body: (
        <p>
          We can update these terms as the product changes. For material changes we will either email
          you or put a notice in the app, and the <strong>Last updated</strong> date at the top of
          this page will change. Continuing to use Job Easy after a change takes effect means you
          accept the new terms; if you do not, stop using the service and ask us to close your
          account.
        </p>
      ),
    },
    {
      id: "governing-law",
      title: "Governing law and disputes",
      body: (
        <>
          <p>
            First, write to us at{" "}
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> — most problems are solved
            there. If a dispute remains, these terms are governed by the laws of the country in
            which the operator of Job Easy is established, and the courts of that country have
            exclusive jurisdiction, except where your local consumer or data-protection law gives
            you rights you cannot give up, in which case you can also act where you live.
          </p>
          <p>
            If any clause turns out to be unenforceable, the rest still stands. Our failure to
            insist on a clause once is not a waiver of it. These terms, together with the Privacy
            Policy, are the whole agreement between us about the service.
          </p>
        </>
      ),
    },
    {
      id: "contact",
      title: "Contact",
      body: (
        <p>
          Questions, complaints, or a report about abuse: email{" "}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. We reply to support mail from
          the address on your account, so please write from it — postal address available on
          request.
        </p>
      ),
    },
  ],
};

export default termsDoc;
