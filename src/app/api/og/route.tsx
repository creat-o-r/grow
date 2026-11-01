import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const name = searchParams.get('name') || 'Plant Assessment';
    const species = searchParams.get('species') || '';
    const viability = searchParams.get('viability') || '';
    const garden = searchParams.get('garden') || 'My Garden';
    const season = searchParams.get('season') || '';
    const reason = searchParams.get('reason') || '';
    const photo = searchParams.get('photo');

    // Viability theme colors
    let badgeBg = '#059669'; // Emerald (High)
    let badgeBorder = '#10b981';
    let badgeLabel = 'HIGH VIABILITY';
    let accentColor = '#34d399';

    if (viability.toLowerCase().includes('medium')) {
      badgeBg = '#d97706'; // Amber Gold (Medium)
      badgeBorder = '#f59e0b';
      badgeLabel = 'MEDIUM VIABILITY';
      accentColor = '#fbbf24';
    } else if (viability.toLowerCase().includes('low')) {
      badgeBg = '#dc2626'; // Coral Red (Low)
      badgeBorder = '#ef4444';
      badgeLabel = 'LOW VIABILITY';
      accentColor = '#f87171';
    }

    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'row',
            backgroundColor: '#04130d',
            backgroundImage: 'radial-gradient(circle at 20% 30%, #0a2f20 0%, #04130d 75%)',
            color: '#ffffff',
            fontFamily: 'sans-serif',
            padding: '36px',
            boxSizing: 'border-box',
          }}
        >
          {/* Left Column: Content */}
          <div
            style={{
              flex: 1,
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              paddingRight: photo ? '36px' : '0px',
              boxSizing: 'border-box',
            }}
          >
            {/* Top Header: Brand & Season */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: '#092d1f',
                  border: '1.5px solid #10b981',
                  borderRadius: '30px',
                  padding: '8px 20px',
                  fontSize: '18px',
                  fontWeight: 800,
                  color: '#34d399',
                  letterSpacing: '0.04em',
                }}
              >
                🌱 GROW ASSISTANT
              </div>
              {season ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    backgroundColor: '#0c261b',
                    border: '1.5px solid #1d4d38',
                    borderRadius: '30px',
                    padding: '8px 18px',
                    fontSize: '17px',
                    fontWeight: 700,
                    color: '#93c5fd',
                  }}
                >
                  {`🗓️ Season: ${season}`}
                </div>
              ) : null}
            </div>

            {/* Middle: Badge, Name, Garden & Reason */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Viability Status Badge */}
              {viability ? (
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      backgroundColor: badgeBg,
                      border: `2px solid ${badgeBorder}`,
                      color: '#ffffff',
                      padding: '9px 22px',
                      borderRadius: '12px',
                      fontSize: '22px',
                      fontWeight: 900,
                      letterSpacing: '0.05em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {`✨ ${badgeLabel}`}
                  </div>
                </div>
              ) : null}

              {/* Plant Name */}
              <div
                style={{
                  display: 'flex',
                  fontSize: name.length > 18 ? '52px' : '64px',
                  fontWeight: 900,
                  color: '#ffffff',
                  lineHeight: 1.05,
                  letterSpacing: '-0.02em',
                  marginTop: '4px',
                }}
              >
                {name}
              </div>

              {/* Species & Garden tags */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {species ? (
                  <div
                    style={{
                      display: 'flex',
                      fontSize: '21px',
                      fontStyle: 'italic',
                      color: '#94a3b8',
                    }}
                  >
                    {species}
                  </div>
                ) : null}
                {species ? (
                  <div style={{ display: 'flex', color: '#475569', fontSize: '18px' }}>•</div>
                ) : null}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    backgroundColor: '#0a3022',
                    border: '1px solid #10b981',
                    borderRadius: '20px',
                    padding: '4px 14px',
                    fontSize: '18px',
                    fontWeight: 700,
                    color: '#6ee7b7',
                  }}
                >
                  {`🏡 ${garden}`}
                </div>
              </div>

              {/* Viability Reasoning Callout Box */}
              {reason ? (
                <div
                  style={{
                    display: 'flex',
                    backgroundColor: 'rgba(255, 255, 255, 0.07)',
                    border: '1.5px solid rgba(255, 255, 255, 0.12)',
                    borderLeft: `5px solid ${accentColor}`,
                    borderRadius: '14px',
                    padding: '16px 20px',
                    marginTop: '6px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      fontSize: '19px',
                      lineHeight: 1.35,
                      color: '#f8fafc',
                      fontWeight: 500,
                    }}
                  >
                    {`"${reason}"`}
                  </div>
                </div>
              ) : null}
            </div>

            {/* Bottom Footer */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderTop: '1px solid rgba(255, 255, 255, 0.12)',
                paddingTop: '16px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  fontSize: '17px',
                  color: '#94a3b8',
                  fontWeight: 600,
                }}
              >
                ⚡ Local-First Gardening • Tap to Import Seed Pack
              </div>
              <div
                style={{
                  display: 'flex',
                  fontSize: '17px',
                  fontWeight: 800,
                  color: '#10b981',
                }}
              >
                grow-rho-two.vercel.app
              </div>
            </div>
          </div>

          {/* Right Column: Framed Photo Card with Rounded Corners & Glow Border */}
          {photo ? (
            <div
              style={{
                width: '470px',
                height: '100%',
                display: 'flex',
                borderRadius: '26px',
                overflow: 'hidden',
                border: '2.5px solid rgba(52, 211, 153, 0.5)',
                boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
                backgroundColor: '#0a2318',
                position: 'relative',
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
