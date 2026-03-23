import React from 'react';

const IsometricFarmOverview = () => {
    return (
        <div className="w-full h-96 relative bg-primary-900/10 rounded-[3rem] border border-white/5 overflow-hidden group">
            <div className="absolute inset-0 cyber-grid-premium opacity-20 group-hover:opacity-40 transition-opacity duration-1000" />
            <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                    <p className="text-4xl font-black text-white/20 uppercase tracking-[0.5em] mb-4">Isometric Grid</p>
                    <p className="text-xs font-bold text-primary-400/40 uppercase tracking-widest">Awaiting Spatial Data Stream...</p>
                </div>
            </div>
            {/* Simple Animated Elements */}
            <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-primary-500/10 rounded-full blur-3xl animate-pulse" />
            <div className="absolute bottom-1/4 right-1/4 w-48 h-48 bg-secondary-500/10 rounded-full blur-3xl animate-pulse delay-700" />
        </div>
    );
};

export default IsometricFarmOverview;
