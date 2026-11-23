import { notFound } from "next/navigation";

// Unknown paths under a language render that language's not-found page inside the layout.
export default function CatchAll() {
  notFound();
}
