import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { getPlantGuildStatus } from '@/extensions/companion-guild';

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

    // 1. Viability badge styling matching app's ViabilityIndicator.tsx
    let viabilityText = 'High Viability';
    let viabilityBg = '#dcfce7'; // green-100
    let viabilityTextCol = '#166534'; // green-800
    let viabilityBorder = '#86efac'; // green-300

    if (viability.toLowerCase().includes('medium')) {
      viabilityText = 'Medium Viability';
      viabilityBg = '#fef9c3'; // yellow-100
      viabilityTextCol = '#854d0e'; // yellow-800
      viabilityBorder = '#fde047'; // yellow-300
    } else if (viability.toLowerCase().includes('low')) {
      viabilityText = 'Low Viability';
      viabilityBg = '#fee2e2'; // red-100
      viabilityTextCol = '#991b1b'; // red-800
      viabilityBorder = '#fca5a5'; // red-300
    }

    // 2. Status badge styling matching app's PlantCard.tsx statusConfig
    let statusLabel = '';
    let statusBg = '#dbeafe';
    let statusTextCol = '#1e40af';
    let statusBorder = '#bfdbfe';

    if (statusParam) {
      const lower = statusParam.toLowerCase();
      if (lower.includes('grow')) {
        statusLabel = 'Growing';
        statusBg = '#dcfce7'; // green-100
        statusTextCol = '#166534'; // green-800
        statusBorder = '#bbf7d0'; // green-200
      } else if (lower.includes('plant') || lower.includes('sown')) {
        statusLabel = 'Planting';
        statusBg = '#ffedd5'; // orange-100
        statusTextCol = '#9a3412'; // orange-800
        statusBorder = '#fed7aa'; // orange-200
      } else if (lower.includes('harvest')) {
        statusLabel = 'Harvest';
        statusBg = '#f3e8ff'; // purple-100
        statusTextCol = '#6b21a8'; // purple-800
        statusBorder = '#e9d5ff'; // purple-200
      } else {
        statusLabel = 'Wishlist';
        statusBg = '#dbeafe'; // blue-100
        statusTextCol = '#1e40af'; // blue-800
        statusBorder = '#bfdbfe'; // blue-200
      }
    }

    // 3. Upcoming viability badge matching app's ViabilityIndicator dashed badge
    const effectiveUpcoming = upcomingParam ? `↑ ${upcomingParam}` : null;

    // 4. Guild status from companion-guild extension
    const guildStatus = getPlantGuildStatus(name, species);
    const effectiveGuild = guildParam || guildStatus.badgeLabel;

    // 5. Seed swap surplus tag matching app's surplus-seed-swap widget
    const effectiveSurplus = surplusParam ? `🤝 ${surplusParam}` : null;

    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: '#edf2ee', // App's soothing sage garden background
            padding: '28px',
            boxSizing: 'border-box',
            fontFamily: 'sans-serif',
          }}
        >
          {/* Main Card Container styled like Grow's PlantCard */}
          <div
            style={{
              height: '100%',
              width: '100%',
              display: 'flex',
              flexDirection: 'row',
              backgroundColor: '#ffffff', // App's card surface
              borderRadius: '20px',
              border: '1.5px solid #d5ded6',
              boxShadow: '0 12px 32px rgba(15, 23, 42, 0.08)',
              padding: '28px',
              boxSizing: 'border-box',
            }}
          >
            {/* Left Content Column */}
            <div
              style={{
                flex: 1,
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                paddingRight: photo ? '28px' : '0px',
                boxSizing: 'border-box',
              }}
            >
              {/* Top Row: App Brand & Garden Pill */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      backgroundColor: '#e6f4ea',
                      border: '1px solid #b7e1cd',
                      borderRadius: '20px',
                      padding: '4px 12px',
                      fontSize: '15px',
                      fontWeight: 800,
                      color: '#137333',
                    }}
                  >
                    🌱 Grow
                  </div>
                  <span style={{ fontSize: '14px', color: '#64748b', fontWeight: 500 }}>
                    Digital Garden Assistant
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {season ? (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        backgroundColor: '#f1f5f9',
                        border: '1px solid #e2e8f0',
                        borderRadius: '20px',
                        padding: '4px 12px',
                        fontSize: '14px',
                        fontWeight: 600,
                        color: '#475569',
                      }}
                    >
                      {`🗓️ ${season}`}
                    </div>
                  ) : null}

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      backgroundColor: '#f1f5f9',
                      border: '1px solid #e2e8f0',
                      borderRadius: '20px',
                      padding: '4px 12px',
                      fontSize: '14px',
                      fontWeight: 600,
                      color: '#334155',
                    }}
                  >
                    {`🏡 ${garden}`}
                  </div>
                </div>
              </div>

              {/* Middle Section: Title, Species, Badges & Reasoning */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
                {/* Plant Name */}
                <div
                  style={{
                    display: 'flex',
                    fontSize: name.length > 20 ? '42px' : '50px',
                    fontWeight: 900,
                    color: '#0f172a',
                    lineHeight: 1.1,
                    letterSpacing: '-0.02em',
                  }}
                >
                  {name}
                </div>

                {/* Botanical Species */}
                {species ? (
                  <div
                    style={{
                      display: 'flex',
                      fontSize: '20px',
                      fontStyle: 'italic',
                      color: '#64748b',
                      marginTop: '-4px',
                    }}
                  >
                    {species}
                  </div>
                ) : null}

                {/* Badges Row — Exactly styled like Grow's PlantCard & ViabilityIndicator */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                  {/* Viability Badge */}
                  {viability ? (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        backgroundColor: viabilityBg,
                        border: `1.5px solid ${viabilityBorder}`,
                        color: viabilityTextCol,
                        padding: '5px 14px',
                        borderRadius: '8px',
                        fontSize: '15px',
                        fontWeight: 700,
                      }}
                    >
                      <span>✨</span>
                      <span>{viabilityText}</span>
                    </div>
                  ) : null}

                  {/* Upcoming Viability (dashed badge like app) */}
                  {effectiveUpcoming ? (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        backgroundColor: '#f0fdf4',
                        border: '1.5px dashed #4ade80',
                        color: '#15803d',
                        padding: '5px 14px',
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: 700,
                      }}
                    >
                      {effectiveUpcoming}
                    </div>
                  ) : null}

                  {/* Status Badge */}
                  {statusLabel ? (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        backgroundColor: statusBg,
                        border: `1.5px solid ${statusBorder}`,
                        color: statusTextCol,
                        padding: '5px 14px',
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: 600,
                      }}
                    >
                      {statusLabel}
                    </div>
                  ) : null}

                  {/* Seed Swap Surplus */}
                  {effectiveSurplus ? (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        backgroundColor: '#fef3c7',
                        border: '1.5px solid #fde68a',
                        color: '#92400e',
                        padding: '5px 14px',
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: 700,
                      }}
                    >
                      {effectiveSurplus}
                    </div>
                  ) : null}

                  {/* Guild Matrix Status */}
                  {effectiveGuild ? (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        backgroundColor: '#f0fdfa',
                        border: '1.5px solid #99f6e4',
                        color: '#0f766e',
                        padding: '5px 14px',
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: 700,
                      }}
                    >
                      <span>🌿</span>
                      <span>{effectiveGuild}</span>
                    </div>
                  ) : null}
                </div>

                {/* Viability Assessment Reasoning Box */}
                {reason ? (
                  <div
                    style={{
                      display: 'flex',
                      backgroundColor: '#f8fafc',
                      border: '1.5px solid #e2e8f0',
                      borderLeft: '4px solid #10b981',
                      borderRadius: '10px',
                      padding: '12px 16px',
                      marginTop: '6px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        fontSize: '16px',
                        lineHeight: 1.35,
                        color: '#334155',
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
                  borderTop: '1px solid #e2e8f0',
                  paddingTop: '12px',
                  marginTop: '6px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    fontSize: '14px',
                    color: '#64748b',
                    fontWeight: 500,
                  }}
                >
                  Local-First Garden • Tap to View & Import Seed Pack
                </div>
                <div
                  style={{
                    display: 'flex',
                    fontSize: '15px',
                    fontWeight: 700,
                    color: '#059669',
                  }}
                >
                  grow-rho-two.vercel.app
                </div>
              </div>
            </div>

            {/* Right Column: Framed Photo Card matching PlantCard image frame */}
            {photo ? (
              <div
                style={{
                  width: '420px',
                  height: '100%',
                  display: 'flex',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  border: '1.5px solid #e2e8f0',
                  backgroundColor: '#f1f5f9',
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
