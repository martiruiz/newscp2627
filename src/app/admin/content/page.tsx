import { Suspense } from "react";
import ContentIdeasPage from "../content-ideas/page";

export default function ContentPage() {
  return (
    <Suspense>
      <ContentIdeasPage />
    </Suspense>
  );
}
