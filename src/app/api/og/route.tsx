import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const name = searchParams.get('name') || 'Plant Viability Assessment';
    const species = searchParams.get('species') || '';
    const viability = searchParams.get('viability') || '';
    const garden = searchParams.get('garden') || 'My Garden';
    const season = searchParams.get('season') || '';
    const photo = searchParams.get('photo');

    // Viability styling
    let badgeBg = '#10b981'; // Green (High)
    let badgeText = '#ffffff';
    let badgeLabel = 'HIGH VIABILITY';

    if (viability.toLowerCase().includes('medium')) {
      badgeBg = '#f59e0b'; // Amber (Medium)
      badgeLabel = 'MEDIUM VIABILITY';
    } else if (viability.toLowerCase().includes('low')) {
      badgeBg = '#ef4444'; // Red (Low)
      badgeLabel = 'LOW VIABILITY';
    }

    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'row',
            backgroundColor: '#062016',
            color: '#ffffff',
            fontFamily: 'sans-serif',
            overflow: 'hidden',
          }}
        >
          {/* Left Column: Information Card */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              padding: '48px 48px',
              backgroundColor: '#062016',
            }}
          >
            {/* Top Header: Brand & Season */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: '#0f3a2a',
                  border: '1px solid #10b981',
                  borderRadius: '20px',
                  padding: '6px 16px',
                  fontSize: '16px',
                  fontWeight: 600,
                  color: '#34d399',
                }}
              >
                🌱 Grow Garden Assistant
              </div>
              {season ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    backgroundColor: '#133527',
                    borderRadius: '20px',
                    padding: '6px 14px',
                    fontSize: '15px',
                    color: '#94a3b8',
                  }}
                >
                  {`Season: ${season}`}
                </div>
              ) : null}
            </div>

            {/* Middle: Plant Name & Viability Badge */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '24px' }}>
              {viability ? (
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      backgroundColor: badgeBg,
                      color: badgeText,
                      padding: '8px 20px',
                      borderRadius: '8px',
                      fontSize: '20px',
                      fontWeight: 800,
                      letterSpacing: '0.05em',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                    }}
                  >
                    {`✨ ${badgeLabel}`}
                  </div>
                </div>
              ) : null}

              <div
                style={{
                  display: 'flex',
                  fontSize: name.length > 20 ? '48px' : '56px',
                  fontWeight: 800,
                  lineHeight: 1.1,
                  color: '#ffffff',
                  letterSpacing: '-0.02em',
                }}
              >
                {name}
              </div>

              {species ? (
                <div
                  style={{
                    display: 'flex',
                    fontSize: '22px',
                    fontStyle: 'italic',
                    color: '#94a3b8',
                    marginTop: '-8px',
                  }}
                >
                  {species}
                </div>
              ) : null}

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '20px',
                  color: '#34d399',
                  fontWeight: 600,
                }}
              >
                {`🏡 Garden: ${garden}`}
              </div>
            </div>

            {/* Bottom Footer: Call to action */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderTop: '1px solid #133527',
                paddingTop: '20px',
                marginTop: '24px',
              }}
            >
              <div style={{ display: 'flex', fontSize: '15px', color: '#64748b' }}>
                Local-First • Zero Server Costs • 1-Click Import
              </div>
              <div style={{ display: 'flex', fontSize: '15px', fontWeight: 700, color: '#10b981' }}>
                grow-rho-two.vercel.app
              </div>
            </div>
          </div>

          {/* Right Column: Plant Photo Thumbnail */}
          {photo ? (
            <div
              style={{
                width: '450px',
                height: '100%',
                display: 'flex',
                position: 'relative',
                overflow: 'hidden',
                backgroundColor: '#0a3324',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo}
                alt={name}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />
            </div>
          ) : null}
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (e: any) {
    console.error('OG Image Generation Error:', e);
    return new Response('Failed to generate OG image', { status: 500 });
  }
}
