import Nav from "@/components/Nav";
import Explainer from "@/components/Explainer";
import ComputeForm from "@/components/ComputeForm"; // from earlier “loading overlay” reply

export default function Home() {
  return (
    <main>
      <Nav />
      <header className="mx-auto max-w-6xl px-4 pt-10">
        <ComputeForm />
      </header>
      <Explainer />
    </main>
  );
}
