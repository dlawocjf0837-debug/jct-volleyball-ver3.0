import React from 'react';
import { useData } from '../contexts/DataContext';
import { VolleyballIcon, FireIcon, ShieldIcon, BoltIcon, SunIcon, StarIcon } from './icons';

interface TeamEmblemProps {
    emblem?: string;
    color?: string;
    className?: string;
}

const iconMap: { [key: string]: React.FC<{ className?: string }> } = {
    'icon_volleyball': VolleyballIcon,
    'icon_fire': FireIcon,
    'icon_shield': ShieldIcon,
    'icon_bolt': BoltIcon,
    'icon_sun': SunIcon,
    'icon_star': StarIcon,
};

const TeamEmblem: React.FC<TeamEmblemProps> = ({ emblem, color, className = 'w-10 h-10' }) => {
    const { userEmblems } = useData();

    const renderContent = () => {
        if (emblem?.startsWith('user_')) {
            const userEmblem = userEmblems.find(e => e.id === emblem);
            if (userEmblem) {
                return <img src={userEmblem.data} alt="Team Emblem" className={`${className} object-cover rounded-md`} />;
            }
        }

        if (emblem?.startsWith('data:image/')) {
            return <img src={emblem} alt="Team Emblem" className={`${className} object-cover rounded-md`} />;
        }

        const IconComponent = (emblem && iconMap[emblem]) || VolleyballIcon;
        const fallbackColorClass = (emblem && iconMap[emblem]) ? 'text-slate-300' : 'text-slate-400';

        const containerStyle: React.CSSProperties = {};
        if (color) {
            containerStyle.color = color;
        }

        return (
            <div className={className} style={containerStyle}>
                <IconComponent className={`w-full h-full ${!color ? fallbackColorClass : ''}`} />
            </div>
        );
    };

    return renderContent();
};

export default TeamEmblem;