import { motion } from "framer-motion";
import { FiArrowRight } from "react-icons/fi";
import { useUiPreferences } from "../../hooks/useUiPreferences";

const NeoHero = ({
  onPrimaryClick,
  onSecondaryClick,
  primaryCtaText,
  secondaryCtaText,
}) => {
  const { t } = useUiPreferences();

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5,
        ease: "easeOut",
      },
    },
  };

  return (
    <motion.div
      className="neo-hero-container"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.div className="neo-hero-content" variants={itemVariants}>
        <motion.h1 className="neo-hero-title" variants={itemVariants}>
          {t("landing.hero.title")}
        </motion.h1>
        <motion.p className="neo-hero-subtitle" variants={itemVariants}>
          {t("landing.hero.subtitle")}
        </motion.p>
        <motion.div className="neo-hero-cta-group" variants={itemVariants}>
          <button className="neo-hero-cta primary" onClick={onPrimaryClick}>
            <span>{primaryCtaText}</span>
            <FiArrowRight />
          </button>
          <button className="neo-hero-cta secondary" onClick={onSecondaryClick}>
            {secondaryCtaText}
          </button>
        </motion.div>
      </motion.div>
    </motion.div>
  );
};

export default NeoHero;
