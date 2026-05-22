import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  ChevronRight,
  ArrowLeft,
  RefreshCw,
  ShoppingBag,
  Heart,
  Star,
  Check,
  Wand2,
  Footprints,
  UserCheck,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { products, Gender, Product } from '@/data/products';
import { useCart } from '@/context/CartContext';
import { Link } from 'react-router-dom';

type QuestionKey = 'topwear' | 'bottomwear' | 'innerwear' | 'footwear';

interface Selections {
  gender: Gender | null;
  topwear: string[];
  bottomwear: string[];
  innerwear: string[];
  footwear: string[];
}

const styleBuilderHeroImage = 'https://images.pexels.com/photos/994523/pexels-photo-994523.jpeg';

const genderOptions: { value: Gender; label: string; image: string; desc: string; accent: string }[] = [
  {
    value: 'Women',
    label: 'Women',
    image: 'https://images.unsplash.com/photo-1581044777550-4cfa60707c03?w=900&fit=crop&auto=format&q=80',
    desc: 'Dresses, Tops, Sarees & more',
    accent: 'from-rose-500/60',
  },
  {
    value: 'Men',
    label: 'Men',
    image: 'https://images.unsplash.com/photo-1552374196-1ab2a1c593e8?w=900&fit=crop&auto=format&q=80',
    desc: 'Shirts, Kurtas, Trousers & more',
    accent: 'from-slate-700/60',
  },
  {
    value: 'Boys',
    label: 'Boys',
    image: 'https://images.unsplash.com/photo-1503944583220-79d8926ad5e2?w=900&fit=crop&auto=format&q=80',
    desc: 'T-Shirts, Shorts, Sets & more',
    accent: 'from-blue-500/60',
  },
  {
    value: 'Girls',
    label: 'Girls',
    image: 'https://images.unsplash.com/photo-1518831959646-742c3a14ebf7?w=900&fit=crop&auto=format&q=80',
    desc: 'Frocks, Tops, Leggings & more',
    accent: 'from-pink-500/60',
  },
  {
    value: 'Unisex',
    label: 'Unisex',
    image: 'https://images.unsplash.com/photo-1523381294911-8d3cead13475?w=900&fit=crop&auto=format&q=80',
    desc: 'Gender-neutral styles',
    accent: 'from-violet-500/60',
  },
];

const questionFlow: Array<{
  key: QuestionKey;
  title: string;
  question: string;
  helper: string;
  emptyMessage: string;
  icon: React.ElementType;
}> = [
  {
    key: 'topwear',
    title: 'Topwear',
    question: 'What topwear do you want?',
    helper: 'Select one answer to continue.',
    emptyMessage: 'No topwear options found for this selection.',
    icon: ShoppingBag,
  },
  {
    key: 'bottomwear',
    title: 'Bottomwear',
    question: 'What bottomwear do you prefer?',
    helper: 'Choose one style for your look.',
    emptyMessage: 'No bottomwear options found for this selection.',
    icon: UserCheck,
  },
  {
    key: 'innerwear',
    title: 'Innerwear',
    question: 'Which innerwear style should we include?',
    helper: 'Pick one answer or skip this step.',
    emptyMessage: 'No innerwear options found. You can skip this step.',
    icon: Heart,
  },
  {
    key: 'footwear',
    title: 'Footwear',
    question: 'What footwear matches your outfit?',
    helper: 'Select one style to complete your collection.',
    emptyMessage: 'No footwear options found for this selection.',
    icon: Footprints,
  },
];

const stepLabels = ['Gender', 'Topwear', 'Bottomwear', 'Innerwear', 'Footwear', 'Results'];

const stageMatcher: Record<QuestionKey, (product: Product) => boolean> = {
  topwear: (product) => /topwear/i.test(product.subCategory),
  bottomwear: (product) => /bottomwear/i.test(product.subCategory),
  innerwear: (product) => /innerwear|loungewear and nightwear|socks/i.test(product.subCategory),
  footwear: (product) => product.masterCategory === 'Footwear' || /shoes|sandal|flip flops/i.test(product.subCategory),
};

const getShuffledSlice = (items: Product[], limit: number) =>
  [...items].sort(() => Math.random() - 0.5).slice(0, limit);

const StepIndicator: React.FC<{ current: number; labels: string[] }> = ({ current, labels }) => (
  <div className="overflow-x-auto w-full">
    <div className="flex items-center justify-center gap-0 min-w-max px-2">
      {labels.map((label, i) => (
        <React.Fragment key={label}>
          <div className="flex flex-col items-center gap-1.5">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold transition-all duration-500 ${
                i < current
                  ? 'bg-primary text-primary-foreground shadow-md shadow-primary/30'
                  : i === current
                  ? 'bg-background text-primary border-2 border-primary shadow-md shadow-primary/20'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {i < current ? <Check size={14} /> : i + 1}
            </div>
            <span
              className={`text-[9px] sm:text-[10px] tracking-wide uppercase font-medium transition-colors duration-300 ${
                i <= current ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              {label}
            </span>
          </div>
          {i < labels.length - 1 && (
            <div className={`h-0.5 w-8 sm:w-12 mx-1 mb-4 rounded-full transition-all duration-500 ${i < current ? 'bg-primary' : 'bg-border'}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  </div>
);

const StyleBuilder: React.FC = () => {
  const [step, setStep] = useState(0);
  const [shuffleSeed, setShuffleSeed] = useState(0);
  const [multiSelectEnabled, setMultiSelectEnabled] = useState(false);
  const [sel, setSel] = useState<Selections>({
    gender: null,
    topwear: [],
    bottomwear: [],
    innerwear: [],
    footwear: [],
  });
  const { addToCart, addToWishlist, removeFromWishlist, isInWishlist } = useCart();

  const heroQuickStats = useMemo(
    () => [
      { label: 'Products', value: `${products.length.toLocaleString()}+` },
      { label: 'Questions', value: questionFlow.length.toString() },
      { label: 'Categories', value: '4' },
      { label: 'AI Assisted', value: 'Yes' },
    ],
    [],
  );

  const genderProducts = useMemo(() => {
    if (!sel.gender) return [];
    return products.filter((product) => product.gender === sel.gender);
  }, [sel.gender]);

  const questionOptions = useMemo<Record<QuestionKey, Array<{ value: string; count: number }>>>(() => {
    const empty = { topwear: [], bottomwear: [], innerwear: [], footwear: [] };
    if (!sel.gender) return empty;

    const toOptions = (key: QuestionKey) => {
      const counts = new Map<string, number>();
      genderProducts
        .filter(stageMatcher[key])
        .forEach((product) => counts.set(product.articleType, (counts.get(product.articleType) ?? 0) + 1));

      return [...counts.entries()]
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
    };

    return {
      topwear: toOptions('topwear'),
      bottomwear: toOptions('bottomwear'),
      innerwear: toOptions('innerwear'),
      footwear: toOptions('footwear'),
    };
  }, [genderProducts, sel.gender]);

  const generatedByStage = useMemo<Record<QuestionKey, Product[]>>(() => {
    const empty = { topwear: [], bottomwear: [], innerwear: [], footwear: [] };
    if (!sel.gender) return empty;

    const pickFor = (key: QuestionKey) => {
      const stageProducts = genderProducts.filter(stageMatcher[key]);
      const selectedAnswers = sel[key];
      const scoped = selectedAnswers.length
        ? stageProducts.filter((product) => selectedAnswers.includes(product.articleType))
        : stageProducts;

      return getShuffledSlice(scoped, 8);
    };

    return {
      topwear: pickFor('topwear'),
      bottomwear: pickFor('bottomwear'),
      innerwear: pickFor('innerwear'),
      footwear: pickFor('footwear'),
    };
  }, [genderProducts, sel.gender, sel.topwear, sel.bottomwear, sel.innerwear, sel.footwear, shuffleSeed]);

  const totalGenerated = useMemo(
    () => Object.values(generatedByStage).reduce((total, list) => total + list.length, 0),
    [generatedByStage],
  );

  const answeredCount = useMemo(
    () => questionFlow.filter((question) => sel[question.key].length > 0).length,
    [sel],
  );

  const currentQuestion = step >= 1 && step <= questionFlow.length ? questionFlow[step - 1] : null;
  const currentOptions = currentQuestion ? questionOptions[currentQuestion.key] : [];
  const currentAnswers = currentQuestion ? sel[currentQuestion.key] : [];

  const handleGenderSelect = (gender: Gender) => {
    setSel({
      gender,
      topwear: [],
      bottomwear: [],
      innerwear: [],
      footwear: [],
    });
    setStep(1);
    setShuffleSeed((prev) => prev + 1);
  };

  const handleAnswerSelect = (key: QuestionKey, value: string) => {
    setSel((prev) => {
      const existingAnswers = prev[key];
      const alreadySelected = existingAnswers.includes(value);

      if (multiSelectEnabled) {
        const nextAnswers = alreadySelected
          ? existingAnswers.filter((item) => item !== value)
          : [...existingAnswers, value];
        return { ...prev, [key]: nextAnswers };
      }

      return {
        ...prev,
        [key]: alreadySelected ? [] : [value],
      };
    });
  };

  const handleContinueQuestion = () => {
    setStep((prev) => Math.min(prev + 1, 5));
  };

  const handleSkipQuestion = (key: QuestionKey) => {
    setSel((prev) => ({ ...prev, [key]: [] }));
    setStep((prev) => Math.min(prev + 1, 5));
  };

  const handleBack = () => setStep((prev) => Math.max(prev - 1, 0));

  const handleRegenerate = () => {
    setShuffleSeed((prev) => prev + 1);
  };

  const handleReset = () => {
    setSel({ gender: null, topwear: [], bottomwear: [], innerwear: [], footwear: [] });
    setStep(0);
    setMultiSelectEnabled(false);
    setShuffleSeed((prev) => prev + 1);
  };

  return (
    <div className="min-h-screen bg-background">

      {/* ── Hero Banner ── */}
      <div className="relative isolate overflow-hidden pt-20">
        <div className="absolute inset-0 z-0">
          <img
            src={styleBuilderHeroImage}
            alt="Style builder"
            loading="eager"
            className="h-full w-full object-cover object-[center_30%]"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-background/20 via-background/78 to-background/95" />
        </div>

        <div className="absolute inset-0 z-[1]">
          <div className="absolute top-0 right-0 w-[600px] h-[400px] bg-primary/8 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[300px] bg-tulip-light/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/3" />
        </div>

        <div className="relative z-10 container mx-auto px-6 pt-14 pb-12 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="inline-flex items-center gap-2 bg-primary/10 backdrop-blur-sm text-primary px-5 py-2 rounded-full text-sm font-semibold mb-5 border border-primary/20"
          >
            <Wand2 size={15} />
            Step-by-Step Style Builder
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="font-display text-5xl md:text-6xl font-medium mb-4 leading-[1.1]"
          >
            Build a Complete Look
            <br />
            <span className="text-gradient-tulip">One Smart Step at a Time</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-muted-foreground text-lg max-w-xl mx-auto font-body leading-relaxed"
          >
            Answer four quick style questions and get a curated outfit set tailored to your vibe, comfort, and daily routine.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.28 }}
            className="mt-7 grid grid-cols-2 sm:grid-cols-4 gap-2 max-w-2xl mx-auto"
          >
            {heroQuickStats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl border border-border/60 bg-background/70 backdrop-blur-sm px-3 py-2"
              >
                <p className="font-display text-lg leading-none text-foreground">{stat.value}</p>
                <p className="font-body text-[10px] uppercase tracking-[0.22em] text-muted-foreground mt-1">
                  {stat.label}
                </p>
              </div>
            ))}
          </motion.div>

          {step > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="mt-8 flex justify-center"
            >
              <div className="rounded-2xl border border-border/60 bg-background/75 backdrop-blur-sm px-4 py-3 max-w-full">
                <StepIndicator current={step} labels={stepLabels} />
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* ── Steps Content ── */}
      <div className="container mx-auto px-4 sm:px-6 max-w-6xl pb-20">
        <AnimatePresence mode="wait">

          {/* ══ Step 0: Gender Question ══ */}
          {step === 0 && (
            <motion.div
              key="step0"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -30 }}
              transition={{ duration: 0.45 }}
              className="mt-8"
            >
              <div className="text-center mb-8">
                <p className="text-primary font-body text-xs uppercase tracking-[0.3em] mb-2">Question 1</p>
                <h2 className="font-display text-2xl sm:text-3xl font-semibold">Who are you shopping for?</h2>
                <p className="text-muted-foreground font-body mt-2">Select one answer to start your style journey.</p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                {genderOptions.map((option, index) => (
                  <motion.button
                    key={option.value}
                    onClick={() => handleGenderSelect(option.value)}
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.07 }}
                    whileHover={{ y: -6, transition: { duration: 0.2 } }}
                    whileTap={{ scale: 0.97 }}
                    className="group relative overflow-hidden rounded-3xl aspect-[3/4] border border-border/50 bg-card/30 shadow-md hover:shadow-2xl hover:shadow-primary/15 transition-all duration-400 cursor-pointer"
                  >
                    <img
                      src={option.image}
                      alt={option.label}
                      loading="lazy"
                      className="absolute inset-0 w-full h-full object-cover object-top brightness-[0.92] transition-transform duration-700 group-hover:scale-110"
                    />
                    <div className={`absolute inset-0 bg-gradient-to-t ${option.accent} via-black/30 to-black/75 opacity-80 group-hover:opacity-90 transition-opacity duration-300`} />
                    <div className="absolute inset-[1px] rounded-[22px] border border-white/10 pointer-events-none" />

                    <div className="absolute inset-0 flex flex-col justify-end p-4 text-white text-left">
                      <span className="font-display text-2xl font-semibold leading-tight drop-shadow">{option.label}</span>
                      <span className="text-[11px] text-white/80 font-body mt-1 leading-snug line-clamp-2">{option.desc}</span>
                    </div>

                    <div className="absolute top-3 left-3 rounded-full bg-white/15 backdrop-blur-sm text-[10px] px-2.5 py-1 text-white/90 uppercase tracking-wider font-medium">
                      Choose
                    </div>
                    <div className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0">
                      <ChevronRight size={16} className="text-white" />
                    </div>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {/* ══ Step 1-4: Question & Answer Flow ══ */}
          {currentQuestion && step >= 1 && step <= 4 && (
            <motion.div
              key={`question-${currentQuestion.key}`}
              initial={{ opacity: 0, x: 60 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -60 }}
              transition={{ duration: 0.45 }}
              className="mt-8"
            >
              <div className="flex items-center justify-between mb-6">
                <button
                  onClick={handleBack}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group"
                >
                  <span className="w-7 h-7 rounded-full border border-border flex items-center justify-center group-hover:border-primary group-hover:text-primary transition-colors">
                    <ArrowLeft size={14} />
                  </span>
                  Back
                </button>

                <div className="text-sm text-muted-foreground font-body">
                  Style Question {step} of {questionFlow.length}
                </div>
              </div>

              <div className="grid lg:grid-cols-[1fr_300px] gap-6">
                <div className="bg-card/80 backdrop-blur-sm border border-border/60 rounded-3xl p-6 shadow-sm">
                  <div className="flex items-start justify-between gap-3 mb-6">
                    <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <currentQuestion.icon size={18} className="text-primary" />
                    </div>
                    <div>
                      <h3 className="font-display text-xl font-semibold leading-tight">{currentQuestion.question}</h3>
                      <p className="text-muted-foreground text-sm font-body mt-1">
                        {multiSelectEnabled ? 'You can select multiple answers for this question.' : currentQuestion.helper}
                      </p>
                    </div>
                    </div>

                    <button
                      onClick={() => setMultiSelectEnabled((prev) => !prev)}
                      className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold tracking-wide uppercase border transition-colors ${
                        multiSelectEnabled
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background text-muted-foreground border-border hover:border-primary hover:text-primary'
                      }`}
                    >
                      Multi Select {multiSelectEnabled ? 'On' : 'Off'}
                    </button>
                  </div>

                  {currentOptions.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-6 text-center">
                      <p className="text-sm text-muted-foreground font-body">{currentQuestion.emptyMessage}</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {currentOptions.map((option) => {
                        const active = currentAnswers.includes(option.value);
                        return (
                          <button
                            key={option.value}
                            onClick={() => handleAnswerSelect(currentQuestion.key, option.value)}
                            className={`text-left rounded-2xl border px-4 py-3 transition-all duration-200 ${
                              active
                                ? 'border-primary bg-primary/10 shadow-sm shadow-primary/20'
                                : 'border-border bg-background hover:border-primary/50 hover:bg-primary/5'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="font-body text-sm font-semibold leading-snug">{option.value}</p>
                                <p className="text-[11px] text-muted-foreground mt-1">{option.count} products available</p>
                              </div>
                              {active && (
                                <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 mt-0.5">
                                  <Check size={12} />
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-end">
                    <Button
                      variant="outline"
                      className="rounded-xl"
                      onClick={() => handleSkipQuestion(currentQuestion.key)}
                    >
                      Skip for now
                    </Button>
                    <Button
                      variant="pink"
                      className="rounded-xl gap-2"
                      onClick={handleContinueQuestion}
                      disabled={currentOptions.length > 0 && currentAnswers.length === 0}
                    >
                      Continue
                      <ChevronRight size={15} />
                    </Button>
                  </div>
                </div>

                <div className="lg:sticky lg:top-24 lg:self-start">
                  <div className="bg-card/85 backdrop-blur-sm border border-border/60 rounded-3xl p-6 space-y-5 shadow-lg shadow-primary/5">
                    <h4 className="font-display text-base font-semibold">Your Answers</h4>

                    <div className="space-y-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Gender</span>
                        <span className="font-medium text-primary">{sel.gender ?? '—'}</span>
                      </div>

                      {questionFlow.map((question) => (
                        <div key={question.key} className="flex items-start justify-between gap-3">
                          <span className="text-muted-foreground">{question.title}</span>
                          <span className="text-right font-medium text-xs sm:text-sm">
                            {sel[question.key].length > 0 ? sel[question.key].join(', ') : 'Not answered'}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="border-t border-border pt-4">
                      <p className="text-xs text-muted-foreground font-body">
                        Answered <span className="text-primary font-semibold">{answeredCount}</span> / {questionFlow.length}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ══ Step 5: Results ══ */}
          {step === 5 && (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.45 }}
              className="mt-8"
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                <div>
                  <button
                    onClick={() => setStep(4)}
                    className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2 group"
                  >
                    <span className="w-6 h-6 rounded-full border border-border flex items-center justify-center group-hover:border-primary transition-colors">
                      <ArrowLeft size={12} />
                    </span>
                    Back to Footwear question
                  </button>
                  <h2 className="font-display text-2xl font-semibold">Your Q&A Style Collection</h2>
                  <p className="text-muted-foreground text-sm font-body mt-1">
                    <span className="text-primary font-semibold">{totalGenerated} styles</span> selected for{' '}
                    <span className="font-medium">{sel.gender}</span>
                  </p>
                </div>

                <div className="flex gap-2 shrink-0">
                  <Button variant="outline" size="sm" className="gap-2 rounded-xl" onClick={handleRegenerate}>
                    <RefreshCw size={13} /> Regenerate
                  </Button>
                  <Button variant="outline" size="sm" className="gap-2 rounded-xl" onClick={handleReset}>
                    <X size={13} /> Start Over
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mb-8 p-3.5 bg-card/70 backdrop-blur-sm rounded-2xl border border-border/60 shadow-sm">
                <span className="text-xs text-muted-foreground self-center mr-1">Answers:</span>
                {questionFlow.map((question) => (
                  <span
                    key={question.key}
                    className="bg-background border border-border text-xs px-2.5 py-1 rounded-full font-medium"
                  >
                    {question.title}: {sel[question.key].length > 0 ? sel[question.key].join(', ') : 'Any'}
                  </span>
                ))}
              </div>

              {totalGenerated === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-24 bg-card border border-border rounded-2xl"
                >
                  <h3 className="font-display text-xl font-medium mb-2">No matches found</h3>
                  <p className="text-muted-foreground mb-6 font-body max-w-xs mx-auto text-sm">
                    Try changing one or two answers and generate again.
                  </p>
                  <Button variant="pink" onClick={() => setStep(1)}>Refine Answers</Button>
                </motion.div>
              ) : (
                <div className="space-y-10">
                  {questionFlow.map((question) => {
                    const sectionProducts = generatedByStage[question.key];
                    const selectedAnswers = sel[question.key];

                    return (
                      <section key={question.key}>
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <p className="text-xs uppercase tracking-[0.2em] text-primary font-body">{question.title}</p>
                            <h3 className="font-display text-2xl leading-tight mt-1">
                              {selectedAnswers.length > 0 ? selectedAnswers.join(', ') : `Recommended ${question.title}`}
                            </h3>
                          </div>
                          <span className="text-xs text-muted-foreground bg-muted/50 px-2.5 py-1 rounded-full border border-border">
                            {sectionProducts.length} picks
                          </span>
                        </div>

                        {sectionProducts.length === 0 ? (
                          <div className="rounded-2xl border border-dashed border-border bg-muted/20 py-8 text-center text-sm text-muted-foreground">
                            No products found for this answer.
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">
                            {sectionProducts.map((product, idx) => {
                              const inWishlist = isInWishlist(product.id);
                              const discount = product.originalPrice
                                ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
                                : 0;

                              return (
                                <motion.div
                                  key={`${question.key}-${product.id}`}
                                  initial={{ opacity: 0, y: 30 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ duration: 0.35, delay: Math.min(idx * 0.03, 0.4) }}
                                  className="group relative rounded-2xl border border-border/60 bg-card/40 p-2.5 sm:p-3 shadow-sm transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/10"
                                >
                                  <div className="aspect-[3/4] mb-3 overflow-hidden bg-secondary rounded-2xl relative">
                                    <Link to={`/product/${product.id}`}>
                                      <img
                                        src={product.image}
                                        alt={product.name}
                                        loading="lazy"
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                                      />
                                    </Link>

                                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                                    <div className="absolute top-2.5 left-2.5 flex flex-col gap-1.5">
                                      {product.isNew && (
                                        <span className="bg-black/80 backdrop-blur-sm text-white text-[9px] px-2.5 py-0.5 rounded-full tracking-widest uppercase font-medium">
                                          New
                                        </span>
                                      )}
                                      {discount > 0 && (
                                        <span className="bg-primary text-primary-foreground text-[9px] px-2.5 py-0.5 rounded-full font-semibold">
                                          -{discount}%
                                        </span>
                                      )}
                                      {product.isAIPick && (
                                        <span className="bg-gradient-to-r from-violet-500 to-pink-500 text-white text-[9px] px-2.5 py-0.5 rounded-full flex items-center gap-0.5 font-medium">
                                          <Sparkles size={8} /> AI Pick
                                        </span>
                                      )}
                                    </div>

                                    <button
                                      onClick={() => (inWishlist ? removeFromWishlist(product.id) : addToWishlist(product))}
                                      className={`absolute top-2.5 right-2.5 w-8 h-8 rounded-full flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 ${
                                        inWishlist
                                          ? 'bg-primary text-primary-foreground opacity-100'
                                          : 'bg-white/90 backdrop-blur-sm text-foreground hover:bg-primary hover:text-primary-foreground'
                                      }`}
                                    >
                                      <Heart size={14} fill={inWishlist ? 'currentColor' : 'none'} />
                                    </button>

                                    <div className="absolute bottom-3 left-3 right-3 opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300">
                                      <button
                                        onClick={() => addToCart(product)}
                                        className="w-full bg-white/95 backdrop-blur-sm text-foreground text-xs font-semibold py-2.5 rounded-xl hover:bg-primary hover:text-primary-foreground transition-colors flex items-center justify-center gap-1.5 shadow-lg"
                                      >
                                        <ShoppingBag size={12} /> Add to Cart
                                      </button>
                                    </div>
                                  </div>

                                  <div className="px-0.5">
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-body truncate">
                                      {product.brand}
                                    </p>
                                    <Link to={`/product/${product.id}`}>
                                      <p className="text-sm font-medium leading-snug line-clamp-2 hover:text-primary transition-colors mt-0.5">
                                        {product.name}
                                      </p>
                                    </Link>
                                    <div className="flex items-center gap-1 mt-1">
                                      <Star size={11} className="fill-yellow-400 text-yellow-400" />
                                      <span className="text-xs text-muted-foreground">{product.rating.toFixed(1)}</span>
                                      <span className="text-[10px] text-muted-foreground/60">({product.reviews})</span>
                                    </div>
                                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                      <span className="text-sm font-bold">₹{product.price.toLocaleString()}</span>
                                      {product.originalPrice && (
                                        <span className="text-xs text-muted-foreground line-through">
                                          ₹{product.originalPrice.toLocaleString()}
                                        </span>
                                      )}
                                      {discount > 0 && (
                                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">{discount}% off</span>
                                      )}
                                    </div>
                                  </div>
                                </motion.div>
                              );
                            })}
                          </div>
                        )}
                      </section>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
};

export default StyleBuilder;
