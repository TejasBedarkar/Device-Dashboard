import React from 'react';
import { LaptopSpecs } from '../types';

interface DashboardProps {
  specs: LaptopSpecs | null;
}

const Dashboard: React.FC<DashboardProps> = ({ specs }) => {
  if (!specs) return null;

  return (
    <div id="specs-container" className="specs-grid">
        {/* Model Card */}
        <div className="spec-card glass">
            <h3>
                <span className="spec-icon">💻</span>
                {specs.modelName}
            </h3>
            <div className="spec-item">
                <span className="spec-label">Last Updated</span>
                <span className="spec-value">{specs.timestamp}</span>
            </div>
             <div className="spec-item">
                <span className="spec-label">Browser Engine</span>
                <span className="spec-value">{specs.browser}</span>
            </div>
        </div>

        {/* Core Specs Card */}
        <div className="spec-card glass">
            <h3><span className="spec-icon">⚡</span>Core Specifications</h3>
            <div className="spec-item">
                <span className="spec-label">CPU</span>
                <span className="spec-value">{specs.processor}</span>
            </div>
             <div className="spec-item">
                <span className="spec-label">GPU</span>
                <span className="spec-value">{specs.gpu}</span>
            </div>
             <div className="spec-item">
                <span className="spec-label">RAM</span>
                <span className="spec-value">{specs.ram}</span>
            </div>
             <div className="spec-item">
                <span className="spec-label">Storage / Res</span>
                <span className="spec-value">{specs.resolution}</span>
            </div>
        </div>

        {/* Details Card */}
        <div className="spec-card glass">
            <h3><span className="spec-icon">🔧</span>Additional Details</h3>
             <div className="spec-item">
                <span className="spec-label">Battery</span>
                <span className="spec-value">{specs.battery || 'N/A'}</span>
            </div>
             <div className="spec-item">
                <span className="spec-label">Weight</span>
                <span className="spec-value">{specs.weight || 'N/A'}</span>
            </div>
             <div className="spec-item">
                <span className="spec-label">Price</span>
                <span className="spec-value">{specs.price || 'N/A'}</span>
            </div>
             <div className="spec-item">
                <span className="spec-label">OS</span>
                <span className="spec-value">{specs.os}</span>
            </div>
        </div>
    </div>
  );
};

export default Dashboard;