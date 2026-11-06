import { useSearchParams } from "react-router";
import CalendarPage from "./CalendarPage";
import UpcomingPage from "./UpcomingPage";

const views = [
  { value: "list", label: "List" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
] as const;

export default function PlannerPage() {
  const [params, setParams] = useSearchParams();
  const requested = params.get("view");
  const view =
    requested === "week" || requested === "month" ? requested : "list";

  const tabs = (
    <div
      role="group"
      aria-label="Planner view"
      className="inline-flex rounded-xl bg-beige p-1"
    >
      {views.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={view === option.value}
          onClick={() =>
            setParams(option.value === "list" ? {} : { view: option.value }, {
              replace: true,
            })
          }
          className={`min-h-9 cursor-pointer rounded-lg px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue ${view === option.value ? "bg-surface text-dark-blue shadow-sm" : "text-gray hover:text-dark-blue"}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="min-w-0 text-dark-blue">
      <header className="relative mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold sm:text-[34px]">Planner</h1>
          <p className="mt-0.5 font-serif text-lg text-gray">
            What’s next on your path
          </p>
        </div>
        <img
          src="/images/trees.png"
          alt=""
          aria-hidden="true"
          className="pointer-events-none -mt-2 -mb-8 h-24 w-28 shrink-0 object-contain sm:h-28 sm:w-32"
        />
      </header>
      {view === "list" ? (
        <>
          {tabs}
          <UpcomingPage />
        </>
      ) : (
        <CalendarPage view={view} tabs={tabs} />
      )}
    </div>
  );
}
