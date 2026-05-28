'use client'
import React, { useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation } from 'swiper/modules';

// Core Swiper styles (Import these in your global CSS or here if your setup allows)
import 'swiper/css';
import 'swiper/css/navigation';

export default function DateSwiper() {
    const [selectedId, setSelectedId] = useState(1);

    const datesData = [
        { id: 1, label: 'Today', date: 'May 28, 2026', highlight: 'Current' },
        { id: 2, label: 'Tomorrow', date: 'May 29, 2026', highlight: 'Upcoming' },
        { id: 3, label: 'After Tomorrow', date: 'May 30, 2026', highlight: 'Weekend' },
        { id: 4, label: 'After One Week', date: 'June 3, 2026', highlight: 'Next Week' },
    ];

    return (
        <div style={styles.wrapper}>
            <Swiper
                modules={[Navigation]}
                navigation={true}
                spaceBetween={12}
                slidesPerView={1}
                breakpoints={{
                    640: { slidesPerView: 2, spaceBetween: 16 },
                    1024: { slidesPerView: 4, spaceBetween: 20 }
                }}
                className="dateSwiper"
                style={styles.swiperContainer}
            >
                {datesData.map((item) => {
                    const isSelected = selectedId === item.id;
                    return (
                        <SwiperSlide key={item.id} style={{ display: 'flex' }}>
                            <div
                                onClick={() => setSelectedId(item.id)}
                                style={{
                                    ...styles.card,
                                    ...(isSelected ? styles.cardActive : styles.cardInactive)
                                }}
                            >
                                <div style={styles.headerRow}>
                                    <span style={{
                                        ...styles.badge,
                                        ...(isSelected ? styles.badgeActive : styles.badgeInactive)
                                    }}>
                                        {item.highlight}
                                    </span>
                                    {isSelected && <div style={styles.dot} />}
                                </div>

                                <h3 style={styles.label}>{item.label}</h3>
                                <p style={styles.dateText}>{item.date}</p>
                            </div>
                        </SwiperSlide>
                    );
                })}
            </Swiper>
        </div>
    );
}

// Minimal, high-performance inline styles to keep bundle lean and zero-config
const styles: Record<string, React.CSSProperties> = {
    wrapper: {
        width: '100%',
        padding: '16px',
        boxSizing: 'border-box',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    },
    swiperContainer: {
        padding: '8px 4px',
        width: '100%',
    },
    card: {
        width: '100%',
        padding: '24px 20px',
        borderRadius: '16px',
        cursor: 'pointer',
        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        minHeight: '150px',
        boxSizing: 'border-box',
        userSelect: 'none',
    },
    cardActive: {
        background: 'linear-gradient(135deg, #1e1b4b 0%, #311042 100%)',
        color: '#ffffff',
        boxShadow: '0 10px 25px -5px rgba(49, 16, 66, 0.3), 0 8px 10px -6px rgba(49, 16, 66, 0.3)',
        transform: 'translateY(-2px)',
        border: '1px solid rgba(255, 255, 255, 0.15)',
    },
    cardInactive: {
        background: 'rgba(255, 255, 255, 0.8)',
        color: '#1e293b',
        border: '1px solid #e2e8f0',
        backdropFilter: 'blur(8px)',
    },
    headerRow: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px',
    },
    badge: {
        fontSize: '11px',
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        padding: '4px 8px',
        borderRadius: '20px',
    },
    badgeActive: {
        background: 'rgba(255, 255, 255, 0.2)',
        color: '#f43f5e',
    },
    badgeInactive: {
        background: '#f1f5f9',
        color: '#64748b',
    },
    dot: {
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        backgroundColor: '#f43f5e',
        boxShadow: '0 0 8px #f43f5e',
    },
    label: {
        fontSize: '22px',
        fontWeight: '800',
        margin: '0 0 4px 0',
        letterSpacing: '-0.02em',
    },
    dateText: {
        fontSize: '14px',
        fontWeight: '500',
        margin: 0,
        opacity: 0.8,
    },
};