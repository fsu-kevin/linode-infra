import { useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import TokenGate from "./components/TokenGate";
import Layout from "./components/Layout";
import Deploy from "./pages/Deploy";
import Provision from "./pages/Provision";
import Firewalls from "./pages/Firewalls";
import Instances from "./pages/Instances";
import Volumes from "./pages/Volumes";
import Domains from "./pages/Domains";
import NodeBalancers from "./pages/NodeBalancers";
import Longview from "./pages/Longview";

export default function App() {
  const [token, setToken] = useState<string | null>(null);

  if (!token) return <TokenGate onToken={setToken} />;

  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Deploy token={token} />} />
          <Route path="/stack" element={<Provision token={token} />} />
          <Route path="/firewalls" element={<Firewalls token={token} />} />
          <Route path="/instances" element={<Instances token={token} />} />
          <Route path="/volumes" element={<Volumes token={token} />} />
          <Route path="/domains" element={<Domains token={token} />} />
          <Route path="/nodebalancers" element={<NodeBalancers token={token} />} />
          <Route path="/longview" element={<Longview token={token} />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
