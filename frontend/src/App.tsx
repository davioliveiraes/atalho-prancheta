import { Layout } from "./components/Layout";
import { ApiPage } from "./pages/ApiPage";
import { HomePage } from "./pages/HomePage";

export default function App() {
  const page = window.location.pathname === "/developers" ? <ApiPage /> : <HomePage />;

  return (
    <Layout>
      {page}
    </Layout>
  );
}
