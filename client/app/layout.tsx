export const metadata = { title: "Slooze FoodApp", description: "RBAC demo" };
import "./globals.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div style={{maxWidth:960, margin:"0 auto", padding:16}}>
          <h1>Slooze FoodApp</h1>
          <p style={{opacity:0.7}}>RBAC + country scoping demo</p>
          {children}
        </div>
      </body>
    </html>
  );
}
