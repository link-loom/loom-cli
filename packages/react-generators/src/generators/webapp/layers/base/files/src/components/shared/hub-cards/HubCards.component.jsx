import { QuickLinkCard } from "@link-loom/react-sdk";

const CARD_CLASS = "d-flex col-12 col-sm-6 col-md-4 col-lg-4 col-xl-3 mb-3";

/**
 * A hub page: a title, one line under it and a grid of cards, as in Mi Retail's settings hubs. Each card is
 * `{ id, href, title, description, Icon, color }`.
 */
export default function HubCards({ title, subtitle, cards }) {
  return (
    <section className="container-fluid my-4 px-4">
      <section className="row">
        <header className="col-12">
          <h4 className="mb-2 mt-1">{title}</h4>
          <p className="text-muted mb-3">{subtitle}</p>
        </header>
        {cards.map((card) => (
          <QuickLinkCard
            key={card.id}
            href={card.href}
            title={card.title}
            description={card.description}
            Icon={card.Icon}
            iconColor={card.color}
            backgroundPercentage={0.15}
            className={CARD_CLASS}
          />
        ))}
      </section>
    </section>
  );
}
