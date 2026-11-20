// The medicine list the app understands, and the interaction warnings it knows about.
//
// This list is hand-written. It covers common prescription and over-the-counter
// medicines and the combinations most likely to hurt an older adult. It is NOT
// complete, and it is not medical advice. Anything it does not recognise is
// flagged so Gloria asks her pharmacist.
//
// To add a medicine: add a line to INGREDIENTS (generic name, classes, other names).
// To add a combination product (e.g. a cold medicine): add it to COMBINATIONS.
// To add a warning: add a rule to RULES.

// [generic name, classes (space separated), brand/other names (comma separated)]
const INGREDIENTS = [
  // Pain and fever
  ['acetaminophen', 'acetaminophen', 'tylenol, paracetamol, apap, panadol, mapap, ofirmev'],
  ['ibuprofen', 'nsaid', 'advil, motrin, midol ib'],
  ['naproxen', 'nsaid', 'aleve, naprosyn, anaprox'],
  ['aspirin', 'nsaid salicylate', 'bayer, ecotrin, bufferin, baby aspirin, asa, alka seltzer, alka-seltzer, st joseph'],
  ['bismuth subsalicylate', 'salicylate', 'pepto bismol, pepto-bismol, pepto, kaopectate'],
  ['diclofenac', 'nsaid', 'voltaren, cataflam, arthrotec'],
  ['meloxicam', 'nsaid', 'mobic'],
  ['celecoxib', 'nsaid', 'celebrex'],
  ['ketorolac', 'nsaid', 'toradol'],
  ['indomethacin', 'nsaid', 'indocin'],
  ['nabumetone', 'nsaid', 'relafen'],
  ['etodolac', 'nsaid', 'lodine'],
  ['caffeine', '', 'no doz, nodoz, vivarin'],

  // Opioid pain medicines
  ['oxycodone', 'opioid sedating', 'oxycontin, roxicodone'],
  ['hydrocodone', 'opioid sedating', 'hysingla, zohydro'],
  ['codeine', 'opioid sedating', ''],
  ['morphine', 'opioid sedating', 'ms contin'],
  ['hydromorphone', 'opioid sedating', 'dilaudid'],
  ['fentanyl', 'opioid sedating', 'duragesic'],
  ['tramadol', 'opioid sedating serotonergic', 'ultram'],
  ['tapentadol', 'opioid sedating serotonergic', 'nucynta'],
  ['methadone', 'opioid sedating', ''],

  // Blood thinners
  ['warfarin', 'anticoagulant', 'coumadin, jantoven'],
  ['apixaban', 'anticoagulant', 'eliquis'],
  ['rivaroxaban', 'anticoagulant', 'xarelto'],
  ['dabigatran', 'anticoagulant', 'pradaxa'],
  ['edoxaban', 'anticoagulant', 'savaysa'],
  ['clopidogrel', 'antiplatelet', 'plavix'],
  ['prasugrel', 'antiplatelet', 'effient'],
  ['ticagrelor', 'antiplatelet', 'brilinta'],

  // Supplements that thin the blood or change blood thinners
  ['fish oil', 'bleeding_supplement', 'omega 3, omega-3, lovaza'],
  ['ginkgo', 'bleeding_supplement', 'ginkgo biloba'],
  ['turmeric', 'bleeding_supplement', 'curcumin'],
  ['garlic supplement', 'bleeding_supplement', 'garlic pills, garlique'],
  ['vitamin e', 'bleeding_supplement', ''],
  ['vitamin k', 'vitamin_k', 'phytonadione'],
  ['st johns wort', 'serotonergic enzyme_inducer', 'st. johns wort, saint johns wort, hypericum'],

  // Antidepressants and mood
  ['sertraline', 'ssri serotonergic', 'zoloft'],
  ['fluoxetine', 'ssri serotonergic', 'prozac'],
  ['citalopram', 'ssri serotonergic', 'celexa'],
  ['escitalopram', 'ssri serotonergic', 'lexapro'],
  ['paroxetine', 'ssri serotonergic', 'paxil'],
  ['venlafaxine', 'ssri serotonergic', 'effexor'],
  ['duloxetine', 'ssri serotonergic', 'cymbalta'],
  ['desvenlafaxine', 'ssri serotonergic', 'pristiq'],
  ['bupropion', '', 'wellbutrin, zyban'],
  ['mirtazapine', 'sedating serotonergic', 'remeron'],
  ['trazodone', 'sedating serotonergic', 'desyrel'],
  ['amitriptyline', 'sedating serotonergic', 'elavil'],
  ['nortriptyline', 'sedating serotonergic', 'pamelor'],
  ['buspirone', 'serotonergic', 'buspar'],
  ['phenelzine', 'maoi', 'nardil'],
  ['tranylcypromine', 'maoi', 'parnate'],
  ['selegiline', 'maoi', 'emsam, eldepryl, zelapar'],
  ['rasagiline', 'maoi', 'azilect'],
  ['lithium', 'lithium', 'lithobid'],
  ['quetiapine', 'sedating', 'seroquel'],
  ['sumatriptan', 'serotonergic', 'imitrex'],

  // Sleep, anxiety, and drowsy medicines
  ['alprazolam', 'benzo sedating', 'xanax'],
  ['lorazepam', 'benzo sedating', 'ativan'],
  ['diazepam', 'benzo sedating', 'valium'],
  ['clonazepam', 'benzo sedating', 'klonopin'],
  ['temazepam', 'benzo sedating', 'restoril'],
  ['zolpidem', 'sedating', 'ambien'],
  ['eszopiclone', 'sedating', 'lunesta'],
  ['melatonin', 'sedating', ''],
  ['diphenhydramine', 'sedating antihistamine', 'benadryl, zzzquil, unisom sleepgels, sominex, nytol'],
  ['doxylamine', 'sedating antihistamine', 'unisom'],
  ['chlorpheniramine', 'sedating antihistamine', 'chlor trimeton, chlor-trimeton'],
  ['hydroxyzine', 'sedating antihistamine', 'atarax, vistaril'],
  ['meclizine', 'sedating antihistamine', 'antivert, bonine, dramamine less drowsy'],
  ['dimenhydrinate', 'sedating antihistamine', 'dramamine'],
  ['cyclobenzaprine', 'sedating', 'flexeril, amrix'],
  ['methocarbamol', 'sedating', 'robaxin'],
  ['tizanidine', 'sedating tizanidine', 'zanaflex'],
  ['baclofen', 'sedating', 'lioresal'],
  ['carisoprodol', 'sedating', 'soma'],
  ['gabapentin', 'sedating', 'neurontin, gralise'],
  ['pregabalin', 'sedating', 'lyrica'],
  ['cannabis', 'sedating', 'marijuana, thc, cbd, edible, edibles'],
  ['alcohol', 'alcohol sedating', 'wine, beer, liquor, vodka, whiskey, bourbon, gin, rum, cocktail, glass of wine'],

  // Allergy and cold medicines that don't cause drowsiness
  ['loratadine', '', 'claritin, alavert'],
  ['cetirizine', '', 'zyrtec'],
  ['fexofenadine', '', 'allegra'],
  ['dextromethorphan', 'serotonergic', 'delsym, robitussin cough, dm'],
  ['guaifenesin', '', 'mucinex, robitussin'],
  ['pseudoephedrine', 'decongestant', 'sudafed'],
  ['phenylephrine', 'decongestant', 'sudafed pe'],

  // Heart and blood pressure
  ['lisinopril', 'ace_arb antihypertensive', 'zestril, prinivil, qbrelis'],
  ['enalapril', 'ace_arb antihypertensive', 'vasotec'],
  ['ramipril', 'ace_arb antihypertensive', 'altace'],
  ['benazepril', 'ace_arb antihypertensive', 'lotensin'],
  ['losartan', 'ace_arb antihypertensive', 'cozaar'],
  ['valsartan', 'ace_arb antihypertensive', 'diovan'],
  ['irbesartan', 'ace_arb antihypertensive', 'avapro'],
  ['olmesartan', 'ace_arb antihypertensive', 'benicar'],
  ['sacubitril', 'antihypertensive', ''],
  ['spironolactone', 'k_sparing antihypertensive', 'aldactone'],
  ['eplerenone', 'k_sparing antihypertensive', 'inspra'],
  ['triamterene', 'k_sparing antihypertensive', 'dyrenium'],
  ['amiloride', 'k_sparing antihypertensive', 'midamor'],
  ['furosemide', 'diuretic antihypertensive', 'lasix'],
  ['bumetanide', 'diuretic antihypertensive', 'bumex'],
  ['torsemide', 'diuretic antihypertensive', 'demadex, soaanz'],
  ['hydrochlorothiazide', 'diuretic antihypertensive', 'hctz, microzide'],
  ['chlorthalidone', 'diuretic antihypertensive', 'thalitone'],
  ['metoprolol', 'beta_blocker antihypertensive', 'lopressor, toprol, toprol xl'],
  ['atenolol', 'beta_blocker antihypertensive', 'tenormin'],
  ['carvedilol', 'beta_blocker antihypertensive', 'coreg'],
  ['propranolol', 'beta_blocker antihypertensive', 'inderal'],
  ['bisoprolol', 'beta_blocker antihypertensive', 'zebeta'],
  ['amlodipine', 'antihypertensive', 'norvasc'],
  ['nifedipine', 'antihypertensive', 'procardia, adalat'],
  ['diltiazem', 'rate_ccb antihypertensive', 'cardizem, tiazac'],
  ['verapamil', 'rate_ccb antihypertensive', 'calan, verelan'],
  ['clonidine', 'antihypertensive sedating', 'catapres'],
  ['hydralazine', 'antihypertensive', ''],
  ['doxazosin', 'alpha_blocker antihypertensive', 'cardura'],
  ['terazosin', 'alpha_blocker antihypertensive', 'hytrin'],
  ['tamsulosin', 'alpha_blocker', 'flomax'],
  ['nitroglycerin', 'nitrate', 'nitrostat, nitro, nitro-dur, nitrolingual'],
  ['isosorbide', 'nitrate', 'imdur, isordil, isosorbide mononitrate, isosorbide dinitrate'],
  ['sildenafil', 'pde5', 'viagra, revatio'],
  ['tadalafil', 'pde5', 'cialis, adcirca'],
  ['vardenafil', 'pde5', 'levitra'],
  ['digoxin', 'digoxin', 'lanoxin'],
  ['amiodarone', 'amiodarone', 'pacerone, cordarone'],
  ['potassium', 'potassium', 'potassium chloride, k-dur, klor-con, klor con, salt substitute, nosalt, nu-salt'],

  // Cholesterol
  ['simvastatin', 'statin_3a4', 'zocor'],
  ['lovastatin', 'statin_3a4', 'mevacor, altoprev'],
  ['atorvastatin', 'statin_3a4', 'lipitor'],
  ['rosuvastatin', '', 'crestor'],
  ['pravastatin', '', 'pravachol'],
  ['ezetimibe', '', 'zetia'],
  ['gemfibrozil', 'gemfibrozil', 'lopid'],
  ['grapefruit', 'grapefruit', 'grapefruit juice'],

  // Diabetes
  ['metformin', 'metformin', 'glucophage, glumetza, fortamet'],
  ['glipizide', 'sulfonylurea', 'glucotrol'],
  ['glyburide', 'sulfonylurea', 'diabeta, glynase'],
  ['glimepiride', 'sulfonylurea', 'amaryl'],
  ['insulin', 'insulin', 'lantus, humalog, novolog, levemir, tresiba, basaglar, humulin, novolin'],
  ['sitagliptin', '', 'januvia'],
  ['empagliflozin', '', 'jardiance'],
  ['semaglutide', '', 'ozempic, rybelsus, wegovy'],

  // Thyroid, bones, stomach, minerals
  ['levothyroxine', 'levothyroxine', 'synthroid, levoxyl, unithroid, euthyrox, tirosint'],
  ['alendronate', 'bisphosphonate', 'fosamax'],
  ['risedronate', 'bisphosphonate', 'actonel, atelvia'],
  ['ibandronate', 'bisphosphonate', 'boniva'],
  ['calcium', 'binder', 'calcium carbonate, calcium citrate, tums, caltrate, os-cal, oscal, citracal, viactiv'],
  ['iron', 'binder', 'ferrous sulfate, ferrous gluconate, feosol, slow fe'],
  ['magnesium', 'binder', 'magnesium oxide, magnesium hydroxide, milk of magnesia, mag-ox'],
  ['aluminum hydroxide', 'binder', ''],
  ['multivitamin', 'binder', 'centrum, one a day, one-a-day, multi vitamin, multivitamins, vitamins'],
  ['omeprazole', 'ppi_2c19', 'prilosec'],
  ['esomeprazole', 'ppi_2c19', 'nexium'],
  ['pantoprazole', '', 'protonix'],
  ['famotidine', '', 'pepcid'],
  ['prednisone', 'steroid', 'deltasone, rayos'],
  ['methylprednisolone', 'steroid', 'medrol'],
  ['dexamethasone', 'steroid', 'decadron'],
  ['methotrexate', 'methotrexate', 'trexall, otrexup'],
  ['allopurinol', '', 'zyloprim'],
  ['donepezil', '', 'aricept'],
  ['memantine', '', 'namenda'],
  ['oxybutynin', '', 'ditropan'],

  // Antibiotics and antifungals
  ['ciprofloxacin', 'quinolone', 'cipro'],
  ['levofloxacin', 'quinolone', 'levaquin'],
  ['moxifloxacin', 'quinolone', 'avelox'],
  ['sulfamethoxazole', 'bactrim', ''],
  ['trimethoprim', 'bactrim', ''],
  ['metronidazole', 'metronidazole', 'flagyl'],
  ['clarithromycin', 'strong_3a4 macrolide', 'biaxin'],
  ['erythromycin', 'strong_3a4 macrolide', 'ery-tab, erythrocin'],
  ['azithromycin', '', 'zithromax, z-pak, z pak, zpak'],
  ['fluconazole', 'fluconazole', 'diflucan'],
  ['itraconazole', 'strong_3a4', 'sporanox'],
  ['ketoconazole', 'strong_3a4', 'nizoral'],
  ['amoxicillin', '', 'amoxil'],
  ['cephalexin', '', 'keflex'],
  ['doxycycline', 'binds_minerals', 'vibramycin, doryx'],
  ['linezolid', 'maoi', 'zyvox'],
];

// Products that contain more than one medicine. Longer names are matched first,
// so "advil pm" is recognised before "advil".
const COMBINATIONS = {
  'tylenol pm': 'acetaminophen, diphenhydramine',
  'tylenol cold': 'acetaminophen, dextromethorphan, phenylephrine',
  'tylenol 3': 'acetaminophen, codeine',
  'tylenol #3': 'acetaminophen, codeine',
  'tylenol with codeine': 'acetaminophen, codeine',
  'advil pm': 'ibuprofen, diphenhydramine',
  'advil cold': 'ibuprofen, phenylephrine',
  'advil sinus': 'ibuprofen, phenylephrine',
  'motrin pm': 'ibuprofen, diphenhydramine',
  'aleve pm': 'naproxen, diphenhydramine',
  'aleve d': 'naproxen, pseudoephedrine',
  'excedrin': 'acetaminophen, aspirin, caffeine',
  'excedrin pm': 'acetaminophen, diphenhydramine',
  'goodys': 'acetaminophen, aspirin, caffeine',
  'goody s': 'acetaminophen, aspirin, caffeine',
  'bc powder': 'aspirin, caffeine',
  'nyquil': 'acetaminophen, dextromethorphan, doxylamine',
  'dayquil': 'acetaminophen, dextromethorphan, phenylephrine',
  'theraflu': 'acetaminophen, phenylephrine, dextromethorphan',
  'theraflu nighttime': 'acetaminophen, phenylephrine, diphenhydramine',
  'coricidin': 'acetaminophen, chlorpheniramine, dextromethorphan',
  'alka seltzer plus': 'acetaminophen, phenylephrine, dextromethorphan',
  'robitussin dm': 'dextromethorphan, guaifenesin',
  'mucinex dm': 'dextromethorphan, guaifenesin',
  'mucinex d': 'guaifenesin, pseudoephedrine',
  'claritin d': 'loratadine, pseudoephedrine',
  'zyrtec d': 'cetirizine, pseudoephedrine',
  'allegra d': 'fexofenadine, pseudoephedrine',
  'percocet': 'oxycodone, acetaminophen',
  'endocet': 'oxycodone, acetaminophen',
  'norco': 'hydrocodone, acetaminophen',
  'vicodin': 'hydrocodone, acetaminophen',
  'lortab': 'hydrocodone, acetaminophen',
  'ultracet': 'tramadol, acetaminophen',
  'bactrim': 'sulfamethoxazole, trimethoprim',
  'septra': 'sulfamethoxazole, trimethoprim',
  'smz tmp': 'sulfamethoxazole, trimethoprim',
  'zestoretic': 'lisinopril, hydrochlorothiazide',
  'hyzaar': 'losartan, hydrochlorothiazide',
  'diovan hct': 'valsartan, hydrochlorothiazide',
  'maxzide': 'triamterene, hydrochlorothiazide',
  'dyazide': 'triamterene, hydrochlorothiazide',
  'entresto': 'sacubitril, valsartan',
  'lotrel': 'amlodipine, benazepril',
  'vytorin': 'simvastatin, ezetimibe',
  'janumet': 'sitagliptin, metformin',
  'maalox': 'aluminum hydroxide, magnesium',
  'mylanta': 'aluminum hydroxide, magnesium',
  'rolaids': 'calcium, magnesium',
  'aggrenox': 'aspirin',
};

// Plain-language names for classes, shown on Bonnie's page.
export const CLASS_LABELS = {
  acetaminophen: 'acetaminophen',
  nsaid: 'anti-inflammatory pain reliever (NSAID)',
  salicylate: 'aspirin-like',
  opioid: 'opioid pain medicine',
  anticoagulant: 'blood thinner',
  antiplatelet: 'blood thinner (anti-platelet)',
  bleeding_supplement: 'supplement that can thin the blood',
  ssri: 'antidepressant',
  maoi: 'MAOI',
  benzo: 'sedative',
  sedating: 'causes drowsiness',
  antihistamine: 'antihistamine',
  decongestant: 'decongestant',
  ace_arb: 'blood pressure (ACE/ARB)',
  k_sparing: 'potassium-sparing water pill',
  diuretic: 'water pill',
  beta_blocker: 'beta blocker',
  rate_ccb: 'heart rate medicine',
  antihypertensive: 'lowers blood pressure',
  nitrate: 'nitrate (chest pain)',
  statin_3a4: 'cholesterol (statin)',
  sulfonylurea: 'diabetes (lowers blood sugar)',
  insulin: 'insulin',
  metformin: 'diabetes',
  levothyroxine: 'thyroid',
  bisphosphonate: 'bone strength',
  binder: 'mineral or antacid',
  steroid: 'steroid',
  quinolone: 'antibiotic',
  macrolide: 'antibiotic',
  bactrim: 'antibiotic',
  metronidazole: 'antibiotic',
  fluconazole: 'antifungal',
  potassium: 'potassium',
  alcohol: 'alcohol',
};

// Each rule says: if one item matches `a` and another matches `b` (or both match
// `same`), show this warning. `a`, `b` and `same` can be a class or a generic name.
// level: 'danger' = do not take without asking; 'caution' = check first / space apart.
// Within a group, only the first matching rule is shown for a pair of medicines.
// {A} and {B} are replaced with the medicine names.
export const RULES = [
  // --- Bleeding ---
  { group: 'bleeding', a: 'nsaid', b: 'anticoagulant', level: 'danger', title: 'Serious bleeding risk',
    message: '{A} and {B} together can cause dangerous bleeding, including in the stomach. Don\'t take {A} unless your doctor said it is OK. For pain, plain Tylenol is usually safer — ask your pharmacist.' },
  { group: 'bleeding', a: 'nsaid', b: 'antiplatelet', level: 'danger', title: 'Bleeding risk',
    message: '{A} and {B} together raise the risk of bleeding, especially in the stomach. Ask your doctor or pharmacist before taking {A}.' },
  { group: 'bleeding', a: 'salicylate', b: 'anticoagulant', level: 'danger', title: 'Bleeding risk',
    message: '{A} contains an aspirin-like ingredient. With {B} it can cause bleeding. Ask your pharmacist before taking it.' },
  { group: 'bleeding', a: 'anticoagulant', b: 'antiplatelet', level: 'danger', title: 'Bleeding risk',
    message: '{A} and {B} are both blood thinners. Taking both raises the risk of serious bleeding. Only take both if your doctor told you to.' },
  { group: 'bleeding', a: 'bleeding_supplement', b: 'anticoagulant', level: 'caution', title: 'May increase bleeding',
    message: '{A} can thin the blood a little. With {B} this can raise the risk of bleeding and bruising. Ask your doctor before taking it regularly.' },
  { group: 'bleeding', a: 'bleeding_supplement', b: 'antiplatelet', level: 'caution', title: 'May increase bleeding',
    message: '{A} can thin the blood a little. With {B} this can raise the risk of bleeding and bruising. Ask your doctor before taking it regularly.' },
  { group: 'bleeding', a: 'ssri', b: 'anticoagulant', level: 'caution', title: 'May increase bleeding',
    message: '{A} with {B} can increase bleeding. Watch for unusual bruising or bleeding and ask your doctor.' },
  { group: 'bleeding', a: 'warfarin', b: 'quinolone', level: 'danger', title: 'Changes blood thinner level',
    message: '{A} and {B} together can make the blood much too thin. Your doctor may need to check your blood (INR) more often. Call your doctor before taking it.' },
  { group: 'bleeding', a: 'warfarin', b: 'bactrim', level: 'danger', title: 'Changes blood thinner level',
    message: '{A} and {B} together can make the blood much too thin. Call your doctor before taking it.' },
  { group: 'bleeding', a: 'warfarin', b: 'metronidazole', level: 'danger', title: 'Changes blood thinner level',
    message: '{A} and {B} together can make the blood much too thin. Call your doctor before taking it.' },
  { group: 'bleeding', a: 'warfarin', b: 'fluconazole', level: 'danger', title: 'Changes blood thinner level',
    message: '{A} and {B} together can make the blood much too thin. Call your doctor before taking it.' },
  { group: 'bleeding', a: 'warfarin', b: 'amiodarone', level: 'danger', title: 'Changes blood thinner level',
    message: '{A} and {B} together can make the blood much too thin. Call your doctor before taking it.' },
  { group: 'bleeding', a: 'warfarin', b: 'macrolide', level: 'caution', title: 'Changes blood thinner level',
    message: '{A} can make {B} stronger. Your doctor may want to check your blood (INR).' },
  { group: 'bleeding', a: 'warfarin', b: 'acetaminophen', level: 'caution', title: 'Can thin the blood more',
    message: 'Taking {B} every day for several days can make {A} stronger. An occasional dose is usually fine. Tell your doctor if you are taking it often.' },
  { group: 'bleeding', a: 'warfarin', b: 'vitamin_k', level: 'caution', title: 'Weakens blood thinner',
    message: '{B} works against {A}. Ask your doctor before taking it.' },
  { group: 'bleeding', a: 'anticoagulant', b: 'enzyme_inducer', level: 'danger', title: 'Weakens blood thinner',
    message: '{B} can make {A} stop working properly, raising the risk of clots and stroke. Do not take it without asking your doctor.' },
  { group: 'bleeding', a: 'antiplatelet', b: 'ppi_2c19', level: 'caution', title: 'May weaken blood thinner',
    message: '{B} can make {A} work less well. Ask your pharmacist — another stomach medicine such as Pepcid may be a better choice.' },
  { group: 'stomach', a: 'nsaid', b: 'steroid', level: 'caution', title: 'Stomach bleeding risk',
    message: '{A} with {B} raises the risk of stomach ulcers and bleeding. Ask your pharmacist first.' },

  // --- Drowsiness and breathing ---
  { group: 'sedation', a: 'opioid', b: 'benzo', level: 'danger', title: 'Dangerous drowsiness and slow breathing',
    message: '{A} and {B} together can make you very sleepy and slow your breathing. This can be life-threatening. Do not take them together unless your doctor told you to.' },
  { group: 'sedation', a: 'alcohol', b: 'opioid', level: 'danger', title: 'Dangerous with alcohol',
    message: 'Alcohol with {B} can slow your breathing and cause falls. Do not drink alcohol with this medicine.' },
  { group: 'sedation', a: 'alcohol', b: 'benzo', level: 'danger', title: 'Dangerous with alcohol',
    message: 'Alcohol with {B} can slow your breathing and cause falls. Do not drink alcohol with this medicine.' },
  { group: 'sedation', a: 'alcohol', b: 'sedating', level: 'caution', title: 'Extra drowsiness',
    message: 'Alcohol with {B} can make you very drowsy and unsteady, which can cause falls.' },
  { group: 'sedation', a: 'opioid', b: 'sedating', level: 'danger', title: 'Too much drowsiness',
    message: '{A} and {B} both make you drowsy. Together they can slow your breathing and cause falls. Ask your doctor or pharmacist first.' },
  { group: 'sedation', same: 'sedating', level: 'caution', title: 'Extra drowsiness and fall risk',
    message: '{A} and {B} both cause drowsiness. Together they can make you confused or unsteady and raise the risk of a fall. Ask your pharmacist first.' },

  // --- Serotonin ---
  { group: 'serotonin', a: 'maoi', b: 'serotonergic', level: 'danger', title: 'Dangerous combination',
    message: '{A} and {B} together can cause a dangerous reaction (serotonin syndrome). Do not take them together.' },
  { group: 'serotonin', a: 'maoi', b: 'decongestant', level: 'danger', title: 'Dangerous blood pressure rise',
    message: '{B} with {A} can cause a dangerous spike in blood pressure. Do not take it.' },
  { group: 'serotonin', a: 'maoi', b: 'opioid', level: 'danger', title: 'Dangerous combination',
    message: '{A} and {B} together can cause a dangerous reaction. Do not take them together.' },
  { group: 'serotonin', a: 'serotonergic', b: 'serotonergic', level: 'caution', title: 'Serotonin reaction risk',
    message: '{A} and {B} both raise serotonin. Together they can cause shaking, sweating, fast heartbeat, or confusion. Ask your pharmacist first.' },

  // --- Blood pressure, potassium and kidneys ---
  { group: 'potassium', a: 'potassium', b: 'k_sparing', level: 'danger', title: 'Potassium may get too high',
    message: '{A} with {B} can raise potassium to a dangerous level, which affects the heart. Ask your doctor first.' },
  { group: 'potassium', a: 'potassium', b: 'ace_arb', level: 'caution', title: 'Potassium may get too high',
    message: '{A} with {B} can raise potassium too high. Ask your doctor before taking it.' },
  { group: 'potassium', a: 'bactrim', b: 'ace_arb', level: 'caution', title: 'Potassium may get too high',
    message: '{A} with {B} can raise potassium too high. Tell the doctor who prescribed {A} that you take {B}.' },
  { group: 'potassium', a: 'bactrim', b: 'k_sparing', level: 'danger', title: 'Potassium may get too high',
    message: '{A} with {B} can raise potassium to a dangerous level. Call your doctor before taking it.' },
  { group: 'kidney', a: 'nsaid', b: 'ace_arb', level: 'caution', title: 'Kidney and blood pressure',
    message: '{A} can make {B} work less well and can strain the kidneys. An occasional dose may be OK — ask your pharmacist, and don\'t take it every day.' },
  { group: 'kidney', a: 'nsaid', b: 'diuretic', level: 'caution', title: 'Kidney and blood pressure',
    message: '{A} can make {B} work less well and can strain the kidneys. Ask your pharmacist before taking it.' },
  { group: 'kidney', a: 'nsaid', b: 'k_sparing', level: 'caution', title: 'Kidney and potassium',
    message: '{A} with {B} can strain the kidneys and raise potassium. Ask your pharmacist before taking it.' },
  { group: 'bp', a: 'decongestant', b: 'antihypertensive', level: 'caution', title: 'Can raise blood pressure',
    message: '{A} can raise blood pressure and make {B} work less well. Ask your pharmacist for a cold medicine that is safe for high blood pressure (such as Coricidin HBP).' },
  { group: 'bp', a: 'nitrate', b: 'pde5', level: 'danger', title: 'Dangerous drop in blood pressure',
    message: '{A} and {B} together can make blood pressure drop dangerously low. Never take them together.' },
  { group: 'bp', a: 'alpha_blocker', b: 'pde5', level: 'caution', title: 'Dizziness and low blood pressure',
    message: '{A} and {B} together can cause dizziness or fainting. Ask your doctor first.' },
  { group: 'heart', a: 'beta_blocker', b: 'rate_ccb', level: 'caution', title: 'Heartbeat may get too slow',
    message: '{A} and {B} both slow the heart. Only take both if your doctor prescribed them together.' },
  { group: 'heart', a: 'digoxin', b: 'amiodarone', level: 'danger', title: 'Digoxin level can get too high',
    message: '{B} can push {A} to a dangerous level. Call your doctor.' },
  { group: 'heart', a: 'digoxin', b: 'macrolide', level: 'danger', title: 'Digoxin level can get too high',
    message: '{B} can push {A} to a dangerous level. Call your doctor before taking it.' },
  { group: 'heart', a: 'digoxin', b: 'verapamil', level: 'caution', title: 'Digoxin level can get too high',
    message: '{B} can raise the level of {A}. Ask your doctor.' },

  // --- Muscle pain from cholesterol medicine ---
  { group: 'statin', a: 'statin_3a4', b: 'strong_3a4', level: 'danger', title: 'Serious muscle damage risk',
    message: '{B} can raise {A} to a level that damages muscles. Ask your doctor — you may need to pause {A} while taking it.' },
  { group: 'statin', a: 'statin_3a4', b: 'gemfibrozil', level: 'danger', title: 'Serious muscle damage risk',
    message: '{A} and {B} together can damage muscles. Ask your doctor.' },
  { group: 'statin', a: 'simvastatin', b: 'amiodarone', level: 'caution', title: 'Muscle damage risk',
    message: '{B} raises the level of {A}. Ask your doctor about the dose.' },
  { group: 'statin', a: 'statin_3a4', b: 'grapefruit', level: 'caution', title: 'Grapefruit and cholesterol medicine',
    message: 'Grapefruit can raise the level of {A} and cause muscle pain. Avoid large amounts of grapefruit or its juice.' },

  // --- Blood sugar ---
  { group: 'sugar', a: 'sulfonylurea', b: 'quinolone', level: 'caution', title: 'Blood sugar may drop or swing',
    message: '{B} with {A} can cause low blood sugar. Check your sugar more often and keep a snack nearby.' },
  { group: 'sugar', a: 'sulfonylurea', b: 'bactrim', level: 'caution', title: 'Blood sugar may drop',
    message: '{B} can make {A} much stronger and cause low blood sugar. Check your sugar more often.' },
  { group: 'sugar', a: 'sulfonylurea', b: 'fluconazole', level: 'caution', title: 'Blood sugar may drop',
    message: '{B} can make {A} stronger and cause low blood sugar. Check your sugar more often.' },
  { group: 'sugar', a: 'insulin', b: 'quinolone', level: 'caution', title: 'Blood sugar may swing',
    message: '{B} can make blood sugar go too low or too high. Check your sugar more often.' },
  { group: 'sugar', a: 'steroid', b: 'insulin', level: 'caution', title: 'Blood sugar may go up',
    message: '{A} raises blood sugar. Check your sugar more often while taking it.' },
  { group: 'sugar', a: 'steroid', b: 'sulfonylurea', level: 'caution', title: 'Blood sugar may go up',
    message: '{A} raises blood sugar. Check your sugar more often while taking it.' },
  { group: 'sugar', a: 'steroid', b: 'metformin', level: 'caution', title: 'Blood sugar may go up',
    message: '{A} raises blood sugar. Check your sugar more often while taking it.' },
  { group: 'sugar', a: 'alcohol', b: 'metformin', level: 'caution', title: 'Alcohol and diabetes medicine',
    message: 'Drinking alcohol with {B} can cause low blood sugar and other problems. Keep it to a small amount, with food.' },
  { group: 'sugar', a: 'alcohol', b: 'sulfonylurea', level: 'caution', title: 'Alcohol and diabetes medicine',
    message: 'Alcohol with {B} can cause low blood sugar. Keep it to a small amount, with food.' },

  // --- Must be spaced apart ---
  { group: 'spacing', a: 'levothyroxine', b: 'binder', level: 'caution', title: 'Take at a different time',
    message: '{B} stops {A} from being absorbed. Take {A} first, then wait at least 4 hours before taking {B}.' },
  { group: 'spacing', a: 'bisphosphonate', b: 'binder', level: 'caution', title: 'Take at a different time',
    message: '{B} stops {A} from working. Take {A} first thing in the morning with plain water, and wait at least an hour before {B}.' },
  { group: 'spacing', a: 'quinolone', b: 'binder', level: 'caution', title: 'Take at a different time',
    message: '{B} stops the antibiotic {A} from working. Take {A} 2 hours before or 6 hours after {B}.' },
  { group: 'spacing', a: 'binds_minerals', b: 'binder', level: 'caution', title: 'Take at a different time',
    message: '{B} stops the antibiotic {A} from working. Take them at least 2 to 3 hours apart.' },
  { group: 'spacing', a: 'quinolone', b: 'tizanidine', level: 'danger', title: 'Dangerous drop in blood pressure',
    message: '{A} raises {B} to a dangerous level, causing very low blood pressure and extreme drowsiness. Do not take them together.' },

  // --- Other serious ones ---
  { group: 'lithium', a: 'lithium', b: 'nsaid', level: 'danger', title: 'Lithium can build up',
    message: '{B} can raise {A} to a poisonous level. Ask your doctor before taking it.' },
  { group: 'lithium', a: 'lithium', b: 'ace_arb', level: 'caution', title: 'Lithium can build up',
    message: '{B} can raise the level of {A}. Your doctor should check your lithium level.' },
  { group: 'lithium', a: 'lithium', b: 'diuretic', level: 'caution', title: 'Lithium can build up',
    message: '{B} can raise the level of {A}. Your doctor should check your lithium level.' },
  { group: 'mtx', a: 'methotrexate', b: 'nsaid', level: 'danger', title: 'Methotrexate can build up',
    message: '{B} can raise {A} to a harmful level. Ask your doctor before taking it.' },
  { group: 'mtx', a: 'methotrexate', b: 'bactrim', level: 'danger', title: 'Serious blood problems',
    message: '{B} with {A} can cause serious blood problems. Call your doctor before taking it.' },
  { group: 'alcohol', a: 'alcohol', b: 'metronidazole', level: 'danger', title: 'Do not drink alcohol',
    message: 'Alcohol with {B} causes severe vomiting, flushing and a racing heart. Avoid alcohol until 3 days after the last dose.' },
  { group: 'alcohol', a: 'alcohol', b: 'acetaminophen', level: 'caution', title: 'Alcohol and acetaminophen',
    message: 'Alcohol with {B} can harm the liver. Keep both to small amounts.' },
  { group: 'alcohol', a: 'alcohol', b: 'anticoagulant', level: 'caution', title: 'Alcohol and blood thinners',
    message: 'Alcohol with {B} raises the risk of bleeding. Keep it to a small amount.' },

  // --- Doubling up on the same kind of medicine ---
  { group: 'duplicate', same: 'acetaminophen', level: 'danger', title: 'Too much acetaminophen',
    message: '{A} and {B} both contain acetaminophen (Tylenol). Taking both can be too much and can damage the liver. Don\'t take more than 3,000 mg a day in total.' },
  { group: 'duplicate', same: 'anticoagulant', level: 'danger', title: 'Two blood thinners',
    message: '{A} and {B} are both blood thinners. Taking both can cause serious bleeding.' },
  { group: 'duplicate', same: 'nsaid', level: 'caution', title: 'Two pain relievers of the same kind',
    message: '{A} and {B} are the same kind of pain reliever (NSAID). Taking both raises the risk of stomach bleeding and kidney problems. Pick one.' },
  { group: 'duplicate', same: 'ssri', level: 'caution', title: 'Two antidepressants',
    message: '{A} and {B} are similar antidepressants. Ask your doctor before taking both.' },
  { group: 'duplicate', same: 'benzo', level: 'danger', title: 'Two sedatives',
    message: '{A} and {B} are both sedatives. Together they can make you dangerously drowsy.' },
  { group: 'duplicate', same: 'ace_arb', level: 'caution', title: 'Two similar blood pressure medicines',
    message: '{A} and {B} work the same way. Ask your doctor before taking both.' },
  { group: 'duplicate', same: 'decongestant', level: 'caution', title: 'Two decongestants',
    message: '{A} and {B} both contain a decongestant. Taking both is too much.' },
  { group: 'duplicate', same: 'antihistamine', level: 'caution', title: 'Two drowsy antihistamines',
    message: '{A} and {B} both contain a drowsy antihistamine. Taking both is too much.' },
];

// ---------------------------------------------------------------------------
// Lookups built from the tables above.

const CLASSES = new Map(); // ingredient -> Set(classes, including its own name)
const ALIASES = new Map(); // normalised name -> [ingredients]
const DISPLAY = new Map(); // normalised name -> nicely capitalised name for suggestions

export function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[®™']/g, '')
    .replace(/[^a-z0-9#]+/g, ' ')
    .trim();
}

const UPPER_WORDS = new Set(['pm', 'dm', 'd', 'hct', 'xl', 'ib', 'bc', 'thc', 'cbd', 'hctz', 'apap', 'asa', 'smz', 'tmp', 'pe']);
function titleCase(s) {
  return s.replace(/\b[a-z]+/g, (w) => (UPPER_WORDS.has(w) ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1)));
}

for (const [ingredient, classes, names] of INGREDIENTS) {
  CLASSES.set(ingredient, new Set([ingredient, ...classes.split(/\s+/).filter(Boolean)]));
  for (const name of [ingredient, ...names.split(',')]) {
    const n = normalize(name);
    if (!n) continue;
    ALIASES.set(n, [ingredient]);
    DISPLAY.set(n, titleCase(name.trim()));
  }
}
for (const [name, list] of Object.entries(COMBINATIONS)) {
  const ingredients = list.split(',').map((s) => s.trim());
  for (const i of ingredients) if (!CLASSES.has(i)) throw new Error(`Unknown ingredient ${i} in ${name}`);
  ALIASES.set(normalize(name), ingredients);
  if (!name.includes('#')) DISPLAY.set(normalize(name), titleCase(name));
}

// Longest names first, so "advil pm" wins over "advil".
const ALIAS_LIST = [...ALIASES.keys()].sort((a, b) => b.length - a.length);
const ALIAS_PATTERNS = new Map(
  ALIAS_LIST.map((a) => [a, new RegExp(`(^| )${a.replace(/[#]/g, '\\#')}( |$)`)])
);

function levenshtein(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return dp[a.length][b.length];
}

/**
 * Work out which medicines a typed name contains.
 * "Advil PM 200mg" -> { ingredients: ['ibuprofen', 'diphenhydramine'], known: true }
 * "advill"         -> { ingredients: ['ibuprofen'], known: true, guessed: 'Advil' }
 */
export function identify(text) {
  let remaining = ` ${normalize(text)} `;
  const found = new Set();
  for (const alias of ALIAS_LIST) {
    const re = ALIAS_PATTERNS.get(alias);
    if (re.test(remaining.trim())) {
      ALIASES.get(alias).forEach((i) => found.add(i));
      remaining = ` ${remaining.trim().replace(re, ' ')} `;
    }
  }
  if (found.size) return { ingredients: [...found], known: true };

  // Nothing matched exactly: allow for small spelling mistakes ("tylanol").
  for (const word of normalize(text).split(' ')) {
    if (word.length < 5) continue;
    const allowed = word.length >= 8 ? 2 : 1;
    let best = null;
    for (const alias of ALIAS_LIST) {
      if (alias.includes(' ') || Math.abs(alias.length - word.length) > allowed) continue;
      const d = levenshtein(word, alias);
      if (d <= allowed && (!best || d < best.d)) best = { alias, d };
    }
    if (best) {
      return { ingredients: [...ALIASES.get(best.alias)], known: true, guessed: DISPLAY.get(best.alias) };
    }
  }
  return { ingredients: [], known: false };
}

export function classesOf(ingredients) {
  const out = new Set();
  for (const i of ingredients) for (const c of CLASSES.get(i) || []) out.add(c);
  return out;
}

/** Short description for Bonnie, e.g. "apixaban — blood thinner". */
export function describe(text) {
  const { ingredients, known, guessed } = identify(text);
  if (!known) return null;
  const parts = ingredients.map((i) => {
    const labels = [...(CLASSES.get(i) || [])]
      .filter((c) => c !== i && CLASS_LABELS[c] && c !== 'antihypertensive' && c !== 'sedating')
      .map((c) => CLASS_LABELS[c]);
    return labels.length ? `${i} (${labels.join(', ')})` : i;
  });
  return { text: parts.join(' + '), guessed };
}

/** Name suggestions while typing. */
export function suggest(text, limit = 6) {
  const q = normalize(text);
  if (q.length < 2) return [];
  const starts = [];
  const contains = [];
  for (const [alias, display] of DISPLAY) {
    if (alias.startsWith(q)) starts.push(display);
    else if (alias.includes(` ${q}`)) contains.push(display);
  }
  const sortFn = (a, b) => a.length - b.length || a.localeCompare(b);
  return [...new Set([...starts.sort(sortFn), ...contains.sort(sortFn)])].slice(0, limit);
}
