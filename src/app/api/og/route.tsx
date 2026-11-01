import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { getPlantGuildProfile } from '@/lib/companion-guild';

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
    const statusParam = searchParams.get('status');
    const upcomingParam = searchParams.get('upcoming');
    const surplusParam = searchParams.get('surplus');
    const guildParam = searchParams.get('guild');

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

    // Status styling
    let statusLabel = '';
    let statusBg = 'rgba(255, 255, 255, 0.08)';
    let statusBorder = 'rgba(255, 255, 255, 0.2)';
    let statusColor = '#e2e8f0';

    if (statusParam) {
      const lowerStatus = statusParam.toLowerCase();
      if (lowerStatus.includes('grow')) {
        statusLabel = '🌱 GROWING';
        statusBg = '#064e3b';
        statusBorder = '#10b981';
        statusColor = '#6ee7b7';
      } else if (lowerStatus.includes('plant') || lowerStatus.includes('sown')) {
        statusLabel = '🪴 SOWN';
        statusBg = '#1e3a8a';
        statusBorder = '#3b82f6';
        statusColor = '#93c5fd';
      } else if (lowerStatus.includes('harvest')) {
        statusLabel = '🌾 HARVESTED';
        statusBg = '#78350f';
        statusBorder = '#f59e0b';
        statusColor = '#fde68a';
      } else if (lowerStatus.includes('wishlist') || lowerStatus.includes('plan')) {
        statusLabel = '📋 WISHLIST';
        statusBg = '#334155';
        statusBorder = '#64748b';
        statusColor = '#cbd5e1';
      } else {
        statusLabel = `🌱 ${statusParam.toUpperCase()}`;
      }
    }

    // Guild tag (use param or infer from species/name)
    const effectiveGuild = guildParam || getPlantGuildProfile(name, species).tag;

    // Upcoming viability tag
    const effectiveUpcoming = upcomingParam ? `📈 Soon: ${upcomingParam}` : null;

    // Seed swap surplus tag
    const effectiveSurplus = surplusParam ? `🤝 ${surplusParam}` : null;

    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'row',
            backgroundColor: '#04130d',
            backgroundImage: 'radial-gradient(circle at 18% 28%, #0a2f20 0%, #04130d 75%)',
            color: '#ffffff',
            fontFamily: 'sans-serif',
            padding: '34px',
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
              paddingRight: photo ? '32px' : '0px',
              boxSizing: 'border-box',
            }}
          >
            {/* Top Header: Brand, Season & Garden */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: '#092d1f',
                  border: '1.5px solid #10b981',
                  borderRadius: '30px',
                  padding: '6px 16px',
                  fontSize: '16px',
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
                    padding: '6px 14px',
                    fontSize: '15px',
                    fontWeight: 700,
                    color: '#93c5fd',
                  }}
                >
                  {`🗓️ ${season}`}
                </div>
              ) : null}

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  backgroundColor: '#0a3022',
                  border: '1.5px solid #10b981',
                  borderRadius: '30px',
                  padding: '6px 14px',
                  fontSize: '15px',
                  fontWeight: 700,
                  color: '#6ee7b7',
                }}
              >
                {`🏡 ${garden}`}
              </div>
            </div>

            {/* Middle Section: Badges, Title, Social Chips & Reason */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {/* Primary Badges: Viability + Status */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {viability ? (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      backgroundColor: badgeBg,
                      border: `2px solid ${badgeBorder}`,
                      color: '#ffffff',
                      padding: '7px 18px',
                      borderRadius: '10px',
                      fontSize: '18px',
                      fontWeight: 900,
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {`✨ ${badgeLabel}`}
                  </div>
                ) : null}

                {statusLabel ? (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      backgroundColor: statusBg,
                      border: `1.5px solid ${statusBorder}`,
                      color: statusColor,
                      padding: '7px 16px',
                      borderRadius: '10px',
                      fontSize: '16px',
                      fontWeight: 800,
                      letterSpacing: '0.04em',
                    }}
                  >
                    {statusLabel}
                  </div>
                ) : null}
              </div>

              {/* Plant Name */}
              <div
                style={{
                  display: 'flex',
                  fontSize: name.length > 20 ? '44px' : '54px',
                  fontWeight: 900,
                  color: '#ffffff',
                  lineHeight: 1.08,
                  letterSpacing: '-0.02em',
                }}
              >
                {name}
              </div>

              {/* Species Botanical Name */}
              {species ? (
                <div
                  style={{
                    display: 'flex',
                    fontSize: '19px',
                    fontStyle: 'italic',
                    color: '#94a3b8',
                    marginTop: '-4px',
                  }}
                >
                  {species}
                </div>
              ) : null}

              {/* Contextual Social Badges (Upcoming Viability, Guild, Seed Swap Surplus) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '2px' }}>
                {effectiveUpcoming ? (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      backgroundColor: '#0d3222',
                      border: '1.5px solid #10b981',
                      borderRadius: '20px',
                      padding: '5px 13px',
                      fontSize: '15px',
                      fontWeight: 800,
                      color: '#a7f3d0',
                    }}
                  >
                    {effectiveUpcoming}
                  </div>
                ) : null}

                {effectiveGuild ? (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      backgroundColor: '#0b2b2b',
                      border: '1.5px solid #14b8a6',
                      borderRadius: '20px',
                      padding: '5px 13px',
                      fontSize: '15px',
                      fontWeight: 800,
                      color: '#5eead4',
                    }}
                  >
                    {effectiveGuild}
                  </div>
                ) : null}

                {effectiveSurplus ? (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      backgroundColor: '#2e1c07',
                      border: '1.5px solid #f59e0b',
                      borderRadius: '20px',
                      padding: '5px 13px',
                      fontSize: '15px',
                      fontWeight: 800,
                      color: '#fde68a',
                    }}
                  >
                    {effectiveSurplus}
                  </div>
                ) : null}
              </div>

              {/* Viability Reasoning Callout Box */}
              {reason ? (
                <div
                  style={{
                    display: 'flex',
                    backgroundColor: 'rgba(255, 255, 255, 0.07)',
                    border: '1.5px solid rgba(255, 255, 255, 0.12)',
                    borderLeft: `5px solid ${accentColor}`,
                    borderRadius: '12px',
                    padding: '12px 18px',
                    marginTop: '4px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      fontSize: '17px',
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
                paddingTop: '14px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  fontSize: '15px',
                  color: '#94a3b8',
                  fontWeight: 600,
                }}
              >
                ⚡ Local-First Gardening • Tap to Import Seed Pack
              </div>
              <div
                style={{
                  display: 'flex',
                  fontSize: '16px',
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
                width: '450px',
                height: '100%',
                display: 'flex',
                borderRadius: '24px',
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
