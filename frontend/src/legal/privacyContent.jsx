/**
 * Privacy Policy copy for the public /privacy page.
 *
 * Same renderer contract as termsContent.jsx: `id` values are deep-link
 * targets, section numbers come from array order. Every claim here is
 * checked against the code — password hashing and token lifetimes
 * (core/config.py, core/security.py), Fernet-encrypted app passwords
 * (core/encryption.py), Resend for transactional mail AND for the shared
 * sending address used in the beta (core/email.py, api/v1/email.py),
 * Gemini/Groq/OpenRouter for AI matching, sessionStorage/localStorage usage
 * (src/api/tokenStorage.js). Please keep it truthful when the stack changes —
 * in particular, re-read "Sending setup" once users can connect their own
 * mailbox, since that wording describes the beta behaviour.
 */
const CONTACT_EMAIL = "info@jobeasy.online";
const RESPONSE_WINDOW = "30 days";

export const privacyDoc = {
  key: "privacy",
  path: "/privacy",
  kicker: "Legal",
  title: "Privacy Policy",
  heading: "Privacy Policy",
  subtitle:
    "What Job Easy stores about you, why it needs it, who else sees it, and how to get it back or removed.",
  updated: "6 September 2026",
  related: { path: "/terms", label: "Terms of Service" },
  note:
    "Job Easy is in early beta and these documents are a working draft written for clarity, not legal advice. " +
    "Fill in the operator name, mailing address, and — if your jurisdiction requires one — a representative or privacy contact, before you rely on them publicly.",
  sections: [
    {
      id: "summary",
      title: "The short version",
      body: (
        <ul className="legal-list legal-list-key">
          <li>
            We collect what the workflow needs: your name, email address, hashed password, your
            templates and CV, and an encrypted app password for the mailbox you choose to send from.
          </li>
          <li>
            We do not sell your data, run advertising on the site, or read your incoming mail.
          </li>
          <li>
            Your CV and template text are only shared with the recipients you choose to email, and
            — if you use Match Template — with an AI provider for that one request.
          </li>
          <li>
            Deleting your account takes your data out within {RESPONSE_WINDOW}; ask by email.
          </li>
          <li>
            In the current beta you only give us a display name to send under; applications leave
            from the shared Job Easy address. If you later connect your own mailbox, the app
            password is stored encrypted and you can revoke it yourself inside your email provider
            at any time.
          </li>
        </ul>
      ),
    },
    {
      id: "scope",
      title: "What this policy covers",
      body: (
        <p>
          It covers the Job Easy web app at <strong>jobeasy.online</strong>, its API, and the
          transactional emails we send you about your account. It does not cover a recruiter's own
          website, job boards you paste from, or third-party services linked from our pages — those
          have their own policies. Throughout, the company behind Job Easy is the data controller
          for the data described here; the operator's legal name and postal address are available on
          request.
        </p>
      ),
    },
    {
      id: "data-we-collect",
      title: "The data we collect",
      body: (
        <>
          <p>
            We keep it deliberately small, and nothing is collected silently from your browsing of
            the public landing page beyond the analytics described further down.
          </p>

          <h3 className="legal-subheading">Account information</h3>
          <ul className="legal-list">
            <li>Your first and last name and email address — the email is also your account ID.</li>
            <li>
              Your password, stored only as a bcrypt hash. We never see or store the plain version.
            </li>
            <li>
              A short verification code we email you while signing up, plus whether the address has
              been verified.
            </li>
            <li>Your role (Visitor, Customer, or Admin) and account status.</li>
          </ul>

          <h3 className="legal-subheading">What you create in the app</h3>
          <ul className="legal-list">
            <li>Template titles, subject lines, and cover-letter text.</li>
            <li>
              The CV file you attach — the PDF itself, its filename, and the text we extract from it
              — so we can attach it to applications.
            </li>
            <li>Any job description you save or paste while working on a template.</li>
          </ul>

          <h3 className="legal-subheading">Sending setup</h3>
          <ul className="legal-list">
            <li>
              The display name recruiters see as the sender. In today's beta the{" "}
              <em>from</em> address is the shared Job Easy address (info@jobeasy.online), sent
              through Resend — we do not ask for, or hold, your mailbox credentials.
            </li>
            <li>
              If you connect your own mailbox once that ships: the sender address, provider, and an
              app password for it, encrypted with Fernet using a key derived from a server-side
              secret. It is never sent back to the browser after you save it, and it is shown to you
              masked.
            </li>
            <li>
              Basic status information about sends you trigger — success or failure, and the error
              we got back — so we can tell you what happened.
            </li>
          </ul>

          <h3 className="legal-subheading">Requests, usage and safety data</h3>
          <ul className="legal-list">
            <li>
              Access requests you submit (why you want access, status, admin notes, timestamps) so
              approval can be reviewed.
            </li>
            <li>
              AI-matching usage counters and timestamps — which day you last ran a match and how many
              times, so the daily limit applies fairly.
            </li>
            <li>
              IP address, user agent, and request timestamps for a short window, used for rate
              limiting and to investigate abuse.
            </li>
            <li>Aggregate performance and traffic metrics from Vercel Analytics and Speed Insights.</li>
            <li>Support correspondence you start with us.</li>
          </ul>

          <p className="legal-callout">
            We do not ask for payment details, identity documents, or precise location, and we do
            not want special-category data (health, religion, biometrics, union membership,
            political opinions) inside a CV or template. Please remove it before uploading.
          </p>
        </>
      ),
    },
    {
      id: "how-we-use",
      title: "How we use it",
      body: (
        <ul className="legal-list">
          <li>To create and secure your account, verify your email, and let you reset a password.</li>
          <li>
            To store and render your templates and CV so you can edit them and reuse them.
          </li>
          <li>To attach your CV and send the application email you asked us to send.</li>
          <li>
            To score your templates against a job description when you run Match Template, and to
            enforce the daily cap on it.
          </li>
          <li>To review access requests and moderate shared default templates.</li>
          <li>
            To keep the service running: rate limiting, error tracking, abuse detection, and
            understanding which parts of the app people use.
          </li>
          <li>To reply to you when you contact support.</li>
        </ul>
      ),
    },
    {
      id: "legal-basis",
      title: "Legal bases we rely on",
      body: (
        <>
          <p>
            Where data-protection law asks us to name a basis (for example under the GDPR or UK
            GDPR):
          </p>
          <ul className="legal-list">
            <li>
              <strong>Performance of a contract</strong> — account, templates, CV, mailbox
              credentials, send status. Without these we cannot provide the service you asked for.
            </li>
            <li>
              <strong>Legitimate interests</strong> — rate limiting, abuse prevention, error
              tracking, aggregate analytics, and replying to support mail.
            </li>
            <li>
              <strong>Consent</strong> — the optional AI matching call for a job description you
              paste, and non-essential analytics where your law requires consent. You can withdraw
              at any time; withdrawal does not undo what already happened.
            </li>
            <li>
              <strong>Legal obligation</strong> — keeping records we are required to keep, and
              responding to valid requests from authorities.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: "recipients",
      title: "Who else sees your data",
      body: (
        <>
          <p>We share the minimum each supplier needs, and no supplier gets everything.</p>
          <ul className="legal-list legal-list-tight">
            <li>
              <strong>Hosting and database</strong> — our infrastructure provider stores the
              account and template data on our behalf.
            </li>
            <li>
              <strong>Resend (transactional mail)</strong> — sends verification codes, reset links,
              and admin notifications, and so holds your email address and message metadata.
            </li>
            <li>
              <strong>Resend, as the sending relay</strong> — in the current beta it delivers your
              applications from the shared Job Easy address, so it handles the message body and your
              CV as an attachment. If you later connect your own mailbox, that handover happens at
              your email provider instead.
            </li>
            <li>
              <strong>The recipients themselves</strong> — anyone you send an application to receives
              your display name, the sending address, your template text, and your CV. That disclosure
              is yours to control; we only act on your instruction.
            </li>
            <li>
              <strong>An AI provider</strong> — Google Gemini, Groq, or OpenRouter, whichever key the
              deployment is configured to use. They receive the job description you pasted and
              excerpts of your templates for that single request.
            </li>
            <li>
              <strong>Vercel</strong> — privacy-friendly, aggregate traffic and performance metrics
              for the frontend.
            </li>
            <li>
              <strong>Our team</strong> — staff and admins, only what they need to approve requests
              or fix a problem you reported.
            </li>
          </ul>
          <p>
            We may also disclose data if we must — to comply with law, a court order, or a serious
            security or legal threat — and if Job Easy is acquired or restructured, in which case the
            new owner has to keep honouring this policy.
          </p>
          <p className="legal-callout legal-callout-plain">
            We do not sell your personal data, and we do not share it with advertisers or data
            brokers.
          </p>
        </>
      ),
    },
    {
      id: "ai-processing",
      title: "AI matching, in more detail",
      body: (
        <>
          <p>
            Match Template is optional. When you use it, we send the provider a prompt containing
            the job description you pasted (up to 4,000 characters) and the identifying parts of
            your templates, and we get back scores and short reasons. We do not send your mailbox
            credentials or your CV file.
          </p>
          <ul className="legal-list">
            <li>
              We do not use your data to train our own models, and we have no models to train.
            </li>
            <li>
              What a provider does with a request is governed by <em>their</em> policy and retention
              terms; free-tier endpoints in particular may retain inputs. If that is a concern for
              you, skip the AI step — everything else works without it.
            </li>
            <li>
              Automated decision-making? No. The score never sends, edits, or deletes anything on
              its own, and a human — you — reviews and approves every email.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: "cookies-storage",
      title: "Cookies and browser storage",
      body: (
        <>
          <p>Job Easy keeps almost nothing in your browser:</p>
          <ul className="legal-list">
            <li>
              <strong>sessionStorage</strong> — your access and refresh tokens, kept per browser tab
              so that signing out (or a session expiry) clears them. The access token is valid for
              15 minutes, the refresh token for 7 days.
            </li>
            <li>
              <strong>localStorage</strong> — interface preferences only, such as whether the sidebar
              is open. Older versions of the app held tokens here; if one is still present we move it
              into sessionStorage the first time you sign in, and it is not kept in both places.
            </li>
            <li>
              <strong>No advertising, profiling, or cross-site tracking cookies</strong>, and no
              third-party marketing pixels.
            </li>
          </ul>
          <p>
            Clearing site data removes these immediately. Because the tokens are what keep you
            signed in, you will have to log in again afterwards.
          </p>
        </>
      ),
    },
    {
      id: "retention",
      title: "How long we keep it",
      body: (
        <>
          <ul className="legal-list legal-list-tight">
            <li>
              Account, template, CV, and mailbox data: for as long as your account exists. Job
              documents are the point of the service, so we keep them until you delete them or your
              account.
            </li>
            <li>
              Verification and reset codes: until they are used or expire — hours, not weeks.
            </li>
            <li>
              AI-match usage counters: rolling daily quota records, kept only to enforce the limit.
            </li>
            <li>
              Security and rate-limit logs: a short rolling window, extended only if an incident is
              under investigation.
            </li>
            <li>
              After a deletion request: out of the live system within {RESPONSE_WINDOW}, and out of
              backups on the next backup rotation, except records we must retain by law.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: "transfers",
      title: "Where your data lives",
      body: (
        <p>
          Job Easy is run from more than one country: hosting and database may sit outside where you
          live, and the AI and email suppliers are global. Where that requires a transfer safeguard,
          we rely on the standard contractual clauses (or an equivalent mechanism the provider
          offers) rather than shipping your data unprotected. Ask us at{" "}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> if you want specifics for your
          region.
        </p>
      ),
    },
    {
      id: "security",
      title: "How we protect it",
      body: (
        <>
          <ul className="legal-list">
            <li>Passwords hashed with bcrypt; never stored in a recoverable form.</li>
            <li>
              If you ever connect a mailbox, its app password is encrypted with Fernet before it
              touches the database, keyed by a server-side secret that is not in the frontend.
            </li>
            <li>
              Sending goes through the platform's own verified address in the beta, so no mailbox
              credential of yours is held by us today.
            </li>
            <li>
              Short-lived JWT access tokens (15 minutes) with a 7-day refresh token, held per tab in
              sessionStorage rather than in long-lived cookies.
            </li>
            <li>Transport encryption (TLS) between your browser, our API, and email providers.</li>
            <li>
              Rate limiting on the API (about 100 requests/minute) and a daily cap on AI calls, both
              to blunt abuse and credential stuffing.
            </li>
            <li>Role checks on every route, so a Visitor cannot reach another user's data.</li>
          </ul>
          <p className="legal-callout">
            No system is perfectly secure. Please use a unique password for Job Easy, give us a
            dedicated app password for sending that you can revoke on its own, and tell us
            immediately if something looks wrong.
          </p>
        </>
      ),
    },
    {
      id: "your-rights",
      title: "Your rights and choices",
      body: (
        <>
          <p>Wherever you live, you can ask us to:</p>
          <ul className="legal-list">
            <li>
              <strong>know</strong> what we hold about you, and get a copy in a usable format —
              including a plain export of your templates;
            </li>
            <li>
              <strong>correct</strong> anything inaccurate — most of this you can do yourself in the
              app;
            </li>
            <li>
              <strong>delete</strong> your account and its data, or restrict or object to processing
              that relies on legitimate interests;
            </li>
            <li>
              <strong>stop</strong> the optional AI step, or disconnect a mailbox, instantly, from
              inside the app or your email provider.
            </li>
          </ul>
          <p>
            Email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> from your registered
            address so we can confirm it is you. We answer within {RESPONSE_WINDOW}, for free unless
            a request is clearly excessive, and we will say so if we cannot do exactly what you asked
            and why. If you are not satisfied, you can complain to your local data-protection
            authority — we would rather you wrote to us first.
          </p>
        </>
      ),
    },
    {
      id: "other-peoples-data",
      title: "Other people's data in your documents",
      body: (
        <>
          <p>
            Two situations involve data that is not yours, and in both of them{" "}
            <strong>you</strong> are the one doing the processing:
          </p>
          <ul className="legal-list">
            <li>
              References or contacts named in a CV: make sure you may share them, and that they
              expect an email from you.
            </li>
            <li>
              Recruiters and hiring managers: their address is usually public for exactly this
              purpose, but tailor your message, keep it factual, and honour a request to stop.
            </li>
          </ul>
          <p>
            We act on your instructions as a processor here, and we will pass on any deletion or
            objection request that reaches us about content you sent.
          </p>
        </>
      ),
    },
    {
      id: "children",
      title: "Children",
      body: (
        <p>
          Job Easy is for adults job-hunting: not for anyone under 16, or under 18 where your local
          law sets that higher. If we learn an account belongs to a child, we close it and delete the
          data. If you think that has happened, write to us and we will fix it.
        </p>
      ),
    },
    {
      id: "breaches",
      title: "If we have a breach",
      body: (
        <p>
          If personal data is exposed and the risk to you is real, we will tell you and any required
          authority without undue delay — normally by email from{" "}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> and with a notice in the app —
          explaining what happened, what we are doing, and what you should do (such as rotating an
          app password or your Job Easy password).
        </p>
      ),
    },
    {
      id: "changes",
      title: "Changes to this policy",
      body: (
        <p>
          We will update this page as the service changes and revise the{" "}
          <strong>Last updated</strong> date. If a change materially reduces your protections, we
          will also announce it in the app or by email rather than leave you to notice.
        </p>
      ),
    },
    {
      id: "contact",
      title: "Contact",
      body: (
        <p>
          Privacy questions, requests, and concerns:{" "}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. Please put "privacy" in the
          subject line. The operator's postal address is available on request.
        </p>
      ),
    },
  ],
};

export default privacyDoc;
