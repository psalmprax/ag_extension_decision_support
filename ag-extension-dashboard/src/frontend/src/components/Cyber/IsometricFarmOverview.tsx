import React from 'react';
import { motion } from 'framer-motion';
import { Box, Layers, Zap } from 'lucide-react';

const IsometricFarmOverview: React.FC = () => {
    return (
        <div className="relative h-64 glass-premium rounded-3xl border-primary-500/20 overflow-hidden group">
            <div className="absolute inset-0 cyber-grid-premium opacity-20 group-hover:opacity-30 transition-opacity" />
            
            <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative w-96 h-48 rotate-x-45 rotate-z-45 transform-gpu transition-transform duration-1000 group-hover:scale-110">
                    {/* Simplified Isometric Base */}
                    <div className="absolute inset-0 bg-primary-500/10 border-2 border-primary-500/30 rounded-lg shadow-[0_0_50px_rgba(0,255,255,0.1)]" />
                    
                    {/* Elements */}
                    <motion.div 
                        initial={{ z: 20, opacity: 0 }}
                        animate={{ z: 0, opacity: 1 }}
                        className="absolute top-10 left-10 w-20 h-20 bg-secondary-500/20 border border-secondary-500/40 rounded flex items-center justify-center"
                    >
                        <Box className="w-8 h-8 text-secondary-400 -rotate-45" />
                    </motion.div>

                    <motion.div 
                        initial={{ z: 40, opacity: 0 }}
                        animate={{ z: 0, opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="absolute bottom-10 right-10 w-24 h-24 bg-primary-500/20 border border-primary-500/40 rounded flex items-center justify-center"
                    >
                        <Layers className="w-10 h-10 text-primary-400 -rotate-45" />
                    </motion.div>

                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                        <Zap className="w-12 h-12 text-yellow-400 animate-pulse" />
                    </div>
                </div>
            </div>

            <div className="absolute bottom-6 left-8">
                <h3 className="text-xl font-black text-white text-glow uppercase tracking-tighter">Spatial Farm Node v2.4</h3>
                <p className="text-[10px] font-bold text-primary-300/40 uppercase tracking-[0.3em]">Neural Topography Sync: Active</p>
            </div>
        </div>
    );
};

export default IsometricFarmOverview;
