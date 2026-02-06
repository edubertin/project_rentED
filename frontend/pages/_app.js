import "../styles/globals.css";
import "leaflet/dist/leaflet.css";
import FooterBar from "../components/FooterBar";

export default function App({ Component, pageProps }) {
  return (
    <>
      <Component {...pageProps} />
      <FooterBar />
    </>
  );
}
