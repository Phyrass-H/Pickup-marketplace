import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Politique de confidentialité · PickUp",
};

// DRAFT placeholder. Final RGPD/GDPR text must be validated with a lawyer before
// go-live (Doc 01). Bilingual FR + EN.
export default function PrivacyPage() {
  return (
    <main className="container" style={{ paddingTop: 28, paddingBottom: 48, maxWidth: 720 }}>
      <p className="small">
        <Link href="/" className="muted">
          ← PickUp
        </Link>
      </p>

      <div className="notice warn">
        Brouillon — en cours de validation juridique (RGPD).
        <br />
        Draft — pending legal (GDPR) review.
      </div>

      <h1>Politique de confidentialité</h1>
      <p className="muted" style={{ marginTop: -6 }}>
        Dernière mise à jour : à définir · Last updated: TBD
      </p>

      <h2>1. Responsable du traitement</h2>
      <p>PickUp. Coordonnées et DPO à compléter.</p>

      <h2>2. Données collectées</h2>
      <p>
        Données de compte (Driver et Dispatcher&nbsp;: nom, téléphone, e-mail,
        véhicule, documents), données de mission (trajets, horaires, Guest), et
        données techniques. À compléter.
      </p>

      <h2>3. Finalités &amp; bases légales</h2>
      <p>
        Fonctionnement du service de mise en relation, conformité réglementaire
        VTC, sécurité. À compléter.
      </p>

      <h2>4. Partage</h2>
      <p>
        Les coordonnées du Driver et du Dispatcher sont révélées mutuellement
        après acceptation d&apos;une mission, pour permettre la réalisation du
        trajet. À compléter (sous-traitants&nbsp;: hébergement, paiement,
        cartographie, supervision).
      </p>

      <h2>5. Durée de conservation</h2>
      <p>À définir.</p>

      <h2>6. Vos droits</h2>
      <p>
        Accès, rectification, effacement, opposition, portabilité. Modalités
        d&apos;exercice à compléter.
      </p>

      <hr style={{ margin: "32px 0", border: 0, borderTop: "1px solid var(--border)" }} />

      <h1>Privacy policy</h1>

      <h2>1. Data controller</h2>
      <p>PickUp. Contact details and DPO to be completed.</p>

      <h2>2. Data we collect</h2>
      <p>
        Account data (Driver and Dispatcher: name, phone, email, vehicle,
        documents), mission data (routes, times, Guest), and technical data. To be
        completed.
      </p>

      <h2>3. Purposes &amp; legal bases</h2>
      <p>
        Operating the matching service, VTC regulatory compliance, security. To be
        completed.
      </p>

      <h2>4. Sharing</h2>
      <p>
        Driver and Dispatcher contact details are revealed to each other after a
        mission is accepted, to enable the trip. To be completed (processors:
        hosting, payments, mapping, monitoring).
      </p>

      <h2>5. Retention</h2>
      <p>TBD.</p>

      <h2>6. Your rights</h2>
      <p>
        Access, rectification, erasure, objection, portability. How to exercise
        them: to be completed.
      </p>
    </main>
  );
}
