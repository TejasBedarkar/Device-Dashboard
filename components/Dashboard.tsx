import React from 'react';
import { LaptopSpecs, FullLaptopSpecs } from '../types';

interface DashboardProps {
  specs: LaptopSpecs | null;
  fullSpecs?: FullLaptopSpecs | null;
}

const Dashboard: React.FC<DashboardProps> = ({ specs, fullSpecs }) => {
  if (!specs) return null;

  return (
    <div id="specs-container" className="specs-grid">
        {/* Model Card */}
        <div className="spec-card glass">
            <h3>
                <span className="spec-icon">💻</span>
                {specs.modelName}
            </h3>
            {fullSpecs?.specifications?.brand && (
                <div className="spec-item">
                    <span className="spec-label">Brand</span>
                    <span className="spec-value">{fullSpecs.specifications.brand}</span>
                </div>
            )}
            {fullSpecs?.specifications?.series && (
                <div className="spec-item">
                    <span className="spec-label">Series</span>
                    <span className="spec-value">{fullSpecs.specifications.series}</span>
                </div>
            )}
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
            {fullSpecs?.specifications?.max_ram_supported && (
                <div className="spec-item">
                    <span className="spec-label">Max RAM</span>
                    <span className="spec-value">{fullSpecs.specifications.max_ram_supported}</span>
                </div>
            )}
            {fullSpecs?.specifications?.storage_options ? (
                <div className="spec-item">
                    <span className="spec-label">Storage</span>
                    <span className="spec-value">{fullSpecs.specifications.storage_options}</span>
                </div>
            ) : (
                <div className="spec-item">
                    <span className="spec-label">Resolution</span>
                    <span className="spec-value">{specs.resolution}</span>
                </div>
            )}
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
                <span className="spec-label">Price Range</span>
                <span className="spec-value">{specs.price || 'N/A'}</span>
            </div>
            <div className="spec-item">
                <span className="spec-label">OS</span>
                <span className="spec-value">{specs.os}</span>
            </div>
        </div>

        {/* Extended Specs Card (if available) */}
        {fullSpecs?.specifications && (
            <>
                <div className="spec-card glass">
                    <h3><span className="spec-icon">📱</span>Connectivity & Ports</h3>
                    {fullSpecs.specifications.ports && (
                        <div className="spec-item">
                            <span className="spec-label">Ports</span>
                            <span className="spec-value">{fullSpecs.specifications.ports}</span>
                        </div>
                    )}
                    {fullSpecs.specifications.connectivity && (
                        <div className="spec-item">
                            <span className="spec-label">Connectivity</span>
                            <span className="spec-value">{fullSpecs.specifications.connectivity}</span>
                        </div>
                    )}
                    {fullSpecs.specifications.webcam && (
                        <div className="spec-item">
                            <span className="spec-label">Webcam</span>
                            <span className="spec-value">{fullSpecs.specifications.webcam}</span>
                        </div>
                    )}
                </div>

                <div className="spec-card glass">
                    <h3><span className="spec-icon">🎨</span>Build & Display</h3>
                    {fullSpecs.specifications.display && (
                        <div className="spec-item">
                            <span className="spec-label">Display</span>
                            <span className="spec-value">{fullSpecs.specifications.display}</span>
                        </div>
                    )}
                    {fullSpecs.specifications.dimensions && (
                        <div className="spec-item">
                            <span className="spec-label">Dimensions</span>
                            <span className="spec-value">{fullSpecs.specifications.dimensions}</span>
                        </div>
                    )}
                    {fullSpecs.specifications.build_quality && (
                        <div className="spec-item">
                            <span className="spec-label">Build Quality</span>
                            <span className="spec-value">{fullSpecs.specifications.build_quality}</span>
                        </div>
                    )}
                    {fullSpecs.specifications.keyboard && (
                        <div className="spec-item">
                            <span className="spec-label">Keyboard</span>
                            <span className="spec-value">{fullSpecs.specifications.keyboard}</span>
                        </div>
                    )}
                </div>

                {fullSpecs.specifications.release_year && (
                    <div className="spec-card glass">
                        <h3><span className="spec-icon">📅</span>Release Information</h3>
                        <div className="spec-item">
                            <span className="spec-label">Release Year</span>
                            <span className="spec-value">{fullSpecs.specifications.release_year}</span>
                        </div>
                    </div>
                )}
            </>
        )}
    </div>
  );
};

export default Dashboard;