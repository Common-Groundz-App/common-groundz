
export type EntityCategory = 'book' | 'movie' | 'place' | 'food' | 'product' | 'music' | 'tv' | 'art' | 'activity' | 'drink' | 'travel' | 'course' | 'app' | 'game' | 'experience';

export const getLoadingMessages = (category: EntityCategory): string[] => {
  const messages: Record<EntityCategory, string[]> = {
    book: [
      "📚 Did you know the average person reads 12 books per year?",
      "✨ Fun fact: Reading before bed can improve sleep quality!",
      "🧠 Reading fiction increases empathy and emotional intelligence",
      "📖 The smell of old books comes from vanilla-scented compounds",
      "🌟 Reading reduces stress levels by up to 68%",
      "📚 Your brain creates new neural pathways when reading",
      "💡 Reading just 6 minutes can reduce stress significantly",
      "🎭 Fiction readers are better at understanding others' emotions",
      "📝 Reading enhances vocabulary and communication skills",
      "🌙 Bedtime stories aren't just for kids - they help adults too!"
    ],
    movie: [
      "🎬 The average movie takes 106 days to film!",
      "🍿 Did you know popcorn became a movie snack during the Great Depression?",
      "🎭 Most movie scenes are shot out of chronological order",
      "🎨 Color psychology in films influences your emotions",
      "🎵 Movie soundtracks can make scenes 25% more memorable",
      "🎪 The first movie theater opened in 1905 in Pittsburgh",
      "🌟 Watching movies together strengthens social bonds",
      "🎯 Your brain processes 24 frames per second in films",
      "🏆 Oscar statues are made of gold-plated bronze",
      "🎥 Silent films weren't actually silent - they had live music!"
    ],
    place: [
      "🌍 There are over 1,000 UNESCO World Heritage Sites globally!",
      "🗺️ Did you know travel can boost creativity by 50%?",
      "🏛️ Every place has a unique story spanning thousands of years",
      "🌸 Visiting new places creates lasting positive memories",
      "🚶‍♂️ Walking in nature reduces anxiety and depression",
      "🏔️ Altitude can affect your taste buds and appetite",
      "🌊 Being near water has proven calming effects on the mind",
      "🎨 Different cultures have influenced architecture worldwide",
      "🦋 Each location has its own unique ecosystem and wildlife",
      "📍 GPS wasn't available to the public until the year 2000!"
    ],
    food: [
      "🍳 Cooking at home saves money and improves nutrition!",
      "🌶️ Spicy foods can boost your metabolism by 8%",
      "🥗 Colorful meals provide more diverse nutrients",
      "👃 You can taste only 5 flavors, but smell thousands!",
      "🧄 Garlic has been used medicinally for over 5,000 years",
      "🍯 Honey never spoils - it's been found in ancient tombs!",
      "🥑 Avocados are technically berries, not vegetables",
      "🔥 Capsaicin in peppers triggers endorphin release",
      "🍅 Tomatoes have more genes than humans do!",
      "🧠 Dark chocolate can improve brain function and mood"
    ],
    product: [
      "🛍️ The average person makes 35,000 decisions per day!",
      "💡 Good design makes products 50% more appealing",
      "♻️ Sustainable products are becoming the new standard",
      "🎯 Reviews help 93% of consumers make better choices",
      "🌟 Quality products can last decades with proper care",
      "🔧 Well-made items often have fascinating origin stories",
      "📦 Packaging design influences purchase decisions by 70%",
      "🎨 Colors in product design affect our buying behavior",
      "⚡ Innovation in products improves our daily lives",
      "🌱 Many everyday products started as happy accidents!"
    ],
    music: [
      "🎵 Music can trigger the release of dopamine in your brain!",
      "🎧 Listening to music while exercising boosts performance by 15%",
      "🧠 Musicians have larger motor, auditory, and visual-spatial regions",
      "💓 Your heartbeat can sync with the rhythm of music",
      "🌙 Slow music before bed improves sleep quality",
      "🎼 Music activates both sides of your brain simultaneously",
      "😊 Happy music can improve your mood within 13 seconds",
      "🎹 Learning music enhances memory and cognitive function",
      "🌍 Music is a universal language understood across cultures",
      "🎤 Singing releases endorphins and reduces stress hormones"
    ],
    tv: [
      "📺 The average person watches 4+ hours of TV daily!",
      "🎭 TV shows create shared cultural experiences globally",
      "🧠 Binge-watching releases dopamine, creating anticipation",
      "🎨 TV production involves hundreds of creative professionals",
      "📖 Many shows are based on books, comics, or real events",
      "🌟 Streaming has revolutionized how we consume content",
      "🎵 Theme songs can instantly transport you to another world",
      "👥 TV watching is becoming more social with live-tweeting",
      "🏆 Awards shows celebrate the artistry behind great TV",
      "🎪 Reality TV reflects and shapes social trends"
    ],
    art: [
      "🎨 Art viewing activates the brain's reward center!",
      "🖼️ Looking at art for just 45 minutes reduces stress",
      "🧠 Creating art improves focus and problem-solving skills",
      "🌈 Colors in art can influence your emotions and mood",
      "👁️ Your brain interprets art differently than photographs",
      "✋ Art therapy is used to help process emotions and trauma",
      "🏛️ Museums preserve culture and history for future generations",
      "💭 Abstract art encourages creative thinking and interpretation",
      "🎭 Art movements reflect the social climate of their time",
      "✨ Everyone interprets art differently - that's the beauty!"
    ],
    activity: [
      "🏃‍♂️ Regular activities boost mood and energy levels!",
      "🧠 New activities create fresh neural pathways in your brain",
      "💪 Physical activities release natural mood elevators",
      "🤝 Group activities strengthen social connections and friendships",
      "🎯 Challenging activities build confidence and resilience",
      "🌟 Hobbies reduce stress and provide mental breaks",
      "⏰ Active breaks improve productivity and focus",
      "🏆 Setting activity goals increases motivation and satisfaction",
      "🌱 Outdoor activities connect you with nature's benefits",
      "😊 Fun activities create lasting positive memories"
    ],
    drink: [
      "☕ Coffee is the world's second-most traded commodity!",
      "🍵 Tea has been enjoyed for over 4,000 years",
      "💧 Proper hydration improves brain function by 23%",
      "🍷 Wine tasting engages all five senses simultaneously",
      "🥤 The carbonation in drinks was discovered by accident",
      "🌿 Herbal teas offer various natural health benefits",
      "🧊 Ice cubes were once more valuable than gold!",
      "🍹 Cocktails tell stories of different cultures and eras",
      "☕ Caffeine can improve physical performance by 11-12%",
      "🥛 Some drinks have been used medicinally for centuries"
    ],
    travel: [
      "✈️ Travel makes you more creative and open-minded!",
      "🗺️ Exploring new places builds confidence and independence",
      "🌍 Travel creates memories that last a lifetime",
      "📸 New experiences stimulate brain plasticity and learning",
      "🎒 Adventure travel can improve problem-solving skills",
      "🌅 Different time zones can temporarily boost alertness",
      "🍽️ Trying local cuisine expands your palate and culture",
      "👥 Travel builds empathy through cultural understanding",
      "🚂 The journey can be just as rewarding as the destination",
      "🌟 Solo travel increases self-confidence and self-reliance"
    ],
    course: [
      "🎓 Learning new skills improves brain plasticity!",
      "📚 Online courses make education more accessible",
      "💡 Continuous learning keeps your mind sharp",
      "🌟 Every expert was once a beginner",
      "🎯 Skill-building opens new career opportunities",
      "🧠 Active learning increases retention by 75%"
    ],
    app: [
      "📱 Apps transform how we live and work!",
      "💡 Great design makes apps intuitive and delightful",
      "🚀 Mobile-first thinking drives innovation",
      "⚡ Apps can save time and simplify daily tasks",
      "🌟 The right app at the right time can change everything"
    ],
    game: [
      "🎮 Gaming improves problem-solving skills!",
      "🧠 Strategic games boost cognitive abilities",
      "🤝 Multiplayer games build teamwork and communication",
      "🎯 Games teach persistence and resilience",
      "⚡ Gaming reaction times translate to real-world skills"
    ],
    experience: [
      "✨ New experiences create lasting memories!",
      "🌟 Stepping outside your comfort zone builds confidence",
      "🎭 Unique experiences enrich your life story",
      "🎨 Trying new things sparks creativity",
      "🚀 Adventures push you to grow and learn"
    ]
  };

  return messages[category] || messages.product;
};

export const getRandomLoadingMessage = (category: EntityCategory): string => {
  const messages = getLoadingMessages(category);
  return messages[Math.floor(Math.random() * messages.length)];
};
