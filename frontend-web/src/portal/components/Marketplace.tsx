/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from "react";
import {
  Heart,
  Grid,
  List as ListIcon,
  Search,
  Star,
  Clock,
  GraduationCap,
  Sparkles,
  ChevronRight,
  Code,
  Brush,
  DollarSign
} from "lucide-react";
import { Course, TutorProfile } from "../types";

interface MarketplaceProps {
  courses: Course[];
  onToggleFavorite: (id: string) => void;
  onTutorChat: (tutorKey: string) => void;
  searchTerm: string;
}

export function Marketplace({
  courses,
  onToggleFavorite,
  onTutorChat,
  searchTerm,
}: MarketplaceProps) {
  // Filters local states
  const [selectedCategories, setSelectedCategories] = useState<string[]>([
    "AI & Data Science",
  ]);
  const [maxPrice, setMaxPrice] = useState<number>(300);
  const [selectedLevels, setSelectedLevels] = useState<string[]>(["Beginner"]);
  const [isGridView, setIsGridView] = useState<boolean>(true);

  // Tutors List from static mockup data
  const tutors: TutorProfile[] = [
    {
      id: "sarah-jenkins",
      name: "Dr. Sarah Jenkins",
      subject: "AI & Machine Learning",
      rating: 4.9,
      reviewsCount: 1200,
      avatarUrl:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuDRu0OVaIcgue-YXnknr5dY-iLecwj2hXTJCP1BwuiISehZGksR-kfcE_isqtt_tihIolfeslpHxKMuBXKWj1CNOEPPXE_SPy1rX-sqbLCrxHwNk54BB6KmaV1A8q0s1sJ39bCu88RA6dgS87wdrEjUcCdlGfQpH1lyt7fPWk1MpWLgNUnqX6eD_VwF8ubV_scELBg1jr2mgcQQpc6kljNIC1fqkJIH5NcJ_m80UfxpT4VhjTp7Mzbtq_sbr1Y9F-IfTdEIHvnvFyaN",
      isOnline: true,
    },
    {
      id: "marco-rossi",
      name: "Marco Rossi",
      subject: "UX/UI Design",
      rating: 4.8,
      reviewsCount: 850,
      avatarUrl:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuAOj4utonxiRWBDxvGBi7FR9eEpgWoqTlDAWQMsNU4dSv4m1bJYxWCf5Wjbwj4In2r9XA9R7K0ipRGcNWsWFmH7spKP8b53rt1jv_ddZBZng2rVnXl4rNBrtgeIJ09DHHS4_y4OWGfF4mFk-GFvGbmkVvwu1tIFmu6OV5X2kruUBrMpo4lzHlhMOqOnNgN2nqxHanw4IwVjL00n96kFGu7r7vzeZvA6IHCQq2Mv1qV6w12heXMx9HI6yIERXdZILhHp3LJVbofLRmuI",
      isOnline: true,
    },
    {
      id: "emily-zhang",
      name: "Dr. Emily Zhang",
      subject: "Data Science",
      rating: 5.0,
      reviewsCount: 2400,
      avatarUrl:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuAOu0naR_Aml1maLDH-wxguqUEJfJvu3dxP7DkzPdScjtAbVA4Zmg973zWw2Pqi4A04IEPct0pQUDp7T2664b95b8lWXtRCMT11PQsmG4HeZVm9fPeyw4rwvIxUCf8QaT3ZEe3ZhZ7TsbzU4o5Qeu--VcybxTr7FVGpQcTxgwv3pypc7W0n7aBc_XAPTEWM5xSztZlZx3LEj_AJcWljAHaN1Dt1YrlkPT8LNgc2M1llrkrmqV1qUiWm7mXRmka0LEZmOg-Ih7VmRNU_",
      isOnline: false,
    },
  ];

  const handleCategoryToggle = (category: string) => {
    if (selectedCategories.includes(category)) {
      setSelectedCategories(selectedCategories.filter((c) => c !== category));
    } else {
      setSelectedCategories([...selectedCategories, category]);
    }
  };

  const handleLevelToggle = (level: string) => {
    if (selectedLevels.includes(level)) {
      setSelectedLevels(selectedLevels.filter((l) => l !== level));
    } else {
      setSelectedLevels([...selectedLevels, level]);
    }
  };

  // Filter Courses dynamically based on user selections and Search term
  const filteredCourses = useMemo(() => {
    return courses.filter((course) => {
      // 1. Search term match
      const titleLower = course.title.toLowerCase();
      const tutorLower = course.tutorName.toLowerCase();
      const termLower = searchTerm.toLowerCase();
      const matchesSearch =
        searchTerm === "" ||
        titleLower.includes(termLower) ||
        tutorLower.includes(termLower);

      if (!matchesSearch) return false;

      // 2. Price match
      if (course.price > maxPrice) return false;

      // 3. Category match
      // We map course to mock categories based on subject
      let courseCategory = "AI & Data Science";
      if (course.title.includes("Web Dev") || course.title.includes("Next.js")) {
        courseCategory = "Web Development";
      } else if (course.title.includes("Leadership") || course.title.includes("Psychology")) {
        courseCategory = "Business Strategy";
      }
      
      const matchesCategory =
        selectedCategories.length === 0 ||
        selectedCategories.includes(courseCategory);

      if (!matchesCategory) return false;

      // 4. Level match
      // For this mock, Course 1 is Beginner, Course 2 is Advanced, Course 3 is Intermediate
      let courseLevel = "Beginner";
      if (course.title.includes("Next.js")) {
        courseLevel = "Advanced";
      } else if (course.title.includes("Psychology") || course.title.includes("Leadership")) {
        courseLevel = "Intermediate";
      }

      const matchesLevel =
        selectedLevels.length === 0 || selectedLevels.includes(courseLevel);

      return matchesLevel;
    });
  }, [courses, selectedCategories, maxPrice, selectedLevels, searchTerm]);

  return (
    <div className="font-sans select-none pb-10">
      
      {/* Immersive Blue Hero Promotional Section */}
      <section className="relative bg-brand-primary rounded-3xl p-8 md:p-12 text-white flex items-center overflow-hidden mb-12 shadow-lg shadow-brand-primary/10">
        <div className="max-w-xl z-10 space-y-6">
          <span className="bg-white/10 text-white rounded-full px-3.5 py-1 text-[10px] font-bold uppercase tracking-wider backdrop-blur-md inline-block">
            SaaS Platform Ecosystem
          </span>
          <h1 className="font-display text-4xl lg:text-5xl font-black leading-tight tracking-tight">
            Discover Your <span className="text-brand-highest font-extrabold underline decoration-white/20">Next Skill</span> &amp; Grow
          </h1>
          <p className="text-white/80 text-sm leading-relaxed max-w-md font-sans">
            Empowering over 2.5 million students worldwide with top-tier tutors and structured learning paths. Your journey to mastery starts here.
          </p>
          <div className="flex flex-wrap gap-4 pt-2">
            <button
              onClick={() => alert("Initiating learning path explorer...")}
              className="px-6 py-3 bg-brand-secondary text-white rounded-2xl text-xs font-display font-black tracking-widest hover:scale-105 hover:bg-brand-secondary-hover transition-transform shadow-md shadow-brand-secondary/25 cursor-pointer"
            >
              Start Learning
            </button>
            <button
              onClick={() => {
                setSelectedCategories(["AI & Data Science", "Web Development", "Business Strategy", "Languages"]);
                setMaxPrice(500);
                setSelectedLevels(["Beginner", "Intermediate", "Advanced"]);
              }}
              className="px-6 py-3 bg-white/10 hover:bg-white/20 backdrop-blur-md text-white border border-white/20 rounded-2xl text-xs font-display font-black tracking-widest transition-all cursor-pointer"
            >
              Browse All
            </button>
          </div>
        </div>

        {/* Floating 3D Vector Representation Image */}
        <div className="hidden md:flex flex-1 justify-end z-10 select-none">
          <div className="w-80 h-85 shrink-0 select-none rounded-2xl overflow-hidden shadow-inner flex items-center justify-center">
            <img
              className="w-full h-full object-contain pointer-events-none"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuAsDug7wNQQuoVwaK5zPOVn2_nj4idTNgfyY7f8_e11FAORf0cLtMV3sFaCdGMQmmPx4p6Md_oOYcvtjbABkjyh26xxDfs-boJ04wX5MOjUQhx71RKZVPE8ENNhm44SJ_H8UfyZzsVucCEsP-OwU8uS7bMtSf-JLyjMLcugVH2C9WUZvPhAbmus-vtmTvUvauLDpKJS0iG3EEtmriwsefCTPLKjADl29IG2ich84MSAUMntQJRRBeVzpJeMafE5T9tJ-_rKDV0DZXkz"
              alt="EduConnect 3D Concept"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-brand-secondary/20 rounded-full blur-3xl shrink-0"></div>
      </section>

      {/* Main Grid: Left Filter Sidebar, Right Content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Left Side Filter Panel */}
        <aside className="w-full space-y-8">
          <div className="bg-white p-6 rounded-2xl border border-brand-border/30 space-y-8 shadow-sm">
            
            {/* Categories checks */}
            <div>
              <h3 className="text-xs font-bold text-brand-text-variant/60 font-display uppercase tracking-widest mb-4">
                Categories
              </h3>
              <div className="space-y-3">
                {[
                  "AI & Data Science",
                  "Web Development",
                  "Business Strategy",
                  "Languages",
                ].map((category) => (
                  <label
                    key={category}
                    className="flex items-center gap-3 cursor-pointer group"
                  >
                    <input
                      type="checkbox"
                      checked={selectedCategories.includes(category)}
                      onChange={() => handleCategoryToggle(category)}
                      className="rounded-md border-brand-border/60 text-brand-primary focus:ring-brand-primary/20 shrink-0 w-4 h-4 cursor-pointer"
                    />
                    <span className="text-sm font-semibold text-brand-text/90 group-hover:text-brand-primary transition-colors">
                      {category}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Price dynamic Slider */}
            <div>
              <h3 className="text-xs font-bold text-brand-text-variant/60 font-display uppercase tracking-widest mb-4">
                Price Range
              </h3>
              <input
                type="range"
                min="50"
                max="500"
                step="10"
                value={maxPrice}
                onChange={(e) => setMaxPrice(Number(e.target.value))}
                className="w-full h-1 bg-brand-container rounded-lg appearance-none cursor-pointer accent-brand-primary outline-none"
              />
              <div className="flex justify-between items-center mt-3 text-xs font-extrabold text-brand-text-variant/85 font-display">
                <span>$50</span>
                <span className="bg-brand-primary/5 text-brand-primary px-2 py-0.5 rounded-lg border border-brand-primary/10">
                  Max: ${maxPrice}
                </span>
                <span>$500+</span>
              </div>
            </div>

            {/* Micro Rating stars */}
            <div>
              <h3 className="text-xs font-bold text-brand-text-variant/60 font-display uppercase tracking-widest mb-4">
                Rating
              </h3>
              <div className="space-y-2">
                <div
                  onClick={() => alert("Filtered by 4.5 Stars & Up rating")}
                  className="flex items-center gap-2 cursor-pointer hover:bg-brand-low/50 p-2 rounded-xl transition-colors text-xs font-bold"
                >
                  <div className="flex text-amber-500">
                    {[1, 2, 3, 4].map((i) => (
                      <Star key={i} className="w-4 h-4 fill-amber-500" />
                    ))}
                    <Star className="w-4 h-4 text-brand-border/60" />
                  </div>
                  <span className="text-brand-text-variant/90">&amp; up</span>
                </div>
              </div>
            </div>

            {/* Student difficulty levels */}
            <div>
              <h3 className="text-xs font-bold text-brand-text-variant/60 font-display uppercase tracking-widest mb-4">
                Level
              </h3>
              <div className="flex flex-wrap gap-2">
                {["Beginner", "Intermediate", "Advanced"].map((level) => {
                  const isChecked = selectedLevels.includes(level);
                  return (
                    <button
                      key={level}
                      onClick={() => handleLevelToggle(level)}
                      className={`px-3 py-1.5 rounded-full text-[10px] font-display font-black tracking-widest uppercase transition-all shadow-sm ${
                        isChecked
                          ? "bg-brand-primary text-white shadow-sm"
                          : "bg-brand-low text-brand-text-variant hover:bg-brand-container"
                      }`}
                    >
                      {level}
                    </button>
                  );
                })}
              </div>
            </div>

          </div>
        </aside>

        {/* Right content core */}
        <div className="lg:col-span-3 space-y-12">
          
          {/* Tutors scroll container block */}
          <section>
            <div className="flex justify-between items-center mb-6">
              <h2 className="font-display font-black text-lg text-brand-text">
                Top Rated Tutors
              </h2>
              <button
                onClick={() => alert("Showing all top 50 network tutors...")}
                className="text-brand-primary font-bold text-xs hover:underline flex items-center gap-1 font-display"
              >
                See All <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="flex gap-6 overflow-x-auto pb-4 custom-scrollbar">
              {tutors.map((tutor) => (
                <div
                  key={tutor.id}
                  className="min-w-[240px] bg-white rounded-2xl p-6 border border-brand-border/30 hover:border-brand-primary flex flex-col items-center text-center transition-all duration-300 shadow-sm relative group hover:shadow-md"
                >
                  <div className="relative mb-4">
                    <img
                      className="w-20 h-20 rounded-full object-cover ring-2 ring-brand-primary/10"
                      src={tutor.avatarUrl}
                      alt={tutor.name}
                      referrerPolicy="no-referrer"
                    />
                    {tutor.isOnline && (
                      <span className="absolute bottom-1 right-1 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full shadow-sm animate-pulse"></span>
                    )}
                  </div>
                  <h4 className="font-display font-black text-sm text-brand-text">
                    {tutor.name}
                  </h4>
                  <p className="text-xs font-semibold text-brand-text-variant/60 mb-3 font-sans">
                    {tutor.subject}
                  </p>
                  <div className="flex items-center gap-1 text-amber-500 mb-4 text-xs font-black">
                    <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500 shrink-0" />
                    <span>{tutor.rating.toFixed(1)}</span>
                    <span className="text-brand-text-variant/40 font-normal">
                      ({tutor.reviewsCount >= 1000 ? `${tutor.reviewsCount / 1000}k` : tutor.reviewsCount})
                    </span>
                  </div>
                  <button
                    onClick={() => onTutorChat(tutor.id)}
                    className="w-full py-2 bg-brand-low text-brand-primary border border-brand-primary/10 rounded-xl hover:bg-brand-primary hover:text-white transition-all text-xs font-display font-black tracking-widest cursor-pointer"
                  >
                    CHAT MENTOR
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* Core dynamic Courses grid explorer */}
          <section>
            <div className="flex justify-between items-center mb-6">
              <h2 className="font-display font-black text-lg text-brand-text">
                Popular Courses
              </h2>
              <div className="flex items-center gap-2 font-display">
                <button
                  onClick={() => setIsGridView(true)}
                  className={`p-2 border border-brand-border/30 rounded-xl transition-colors cursor-pointer ${
                    isGridView ? "bg-brand-low text-brand-primary" : "text-brand-text-variant"
                  }`}
                  title="Grid Layout"
                >
                  <Grid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setIsGridView(false)}
                  className={`p-2 border border-brand-border/30 rounded-xl transition-colors cursor-pointer ${
                    !isGridView ? "bg-brand-low text-brand-primary" : "text-brand-text-variant"
                  }`}
                  title="List Layout"
                >
                  <ListIcon className="w-4 h-4" />
                </button>
              </div>
            </div>

            {filteredCourses.length === 0 ? (
              <div className="bg-white rounded-3xl p-16 text-center border border-brand-border/30 text-brand-text-variant/60 flex flex-col items-center justify-center gap-3">
                <Sparkles className="w-10 h-10 text-yellow-400" />
                <p className="text-base font-bold">No courses matched your filters</p>
                <p className="text-xs max-w-sm">
                  Try widening your price range, clearing some category filters, or searching for other items in our system.
                </p>
                <button
                  onClick={() => {
                    setSelectedCategories(["AI & Data Science", "Web Development", "Business Strategy"]);
                    setMaxPrice(500);
                    setSelectedLevels(["Beginner", "Intermediate", "Advanced"]);
                  }}
                  className="px-5 py-2.5 bg-brand-primary/10 hover:bg-brand-primary/15 text-brand-primary text-xs font-bold rounded-xl transition-all font-display mt-2"
                >
                  Reset Active Filters
                </button>
              </div>
            ) : (
              <div
                className={
                  isGridView
                    ? "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8"
                    : "space-y-6"
                }
              >
                {filteredCourses.map((course) => (
                  <div
                    key={course.id}
                    className={`bg-white rounded-3xl border border-brand-border/30 overflow-hidden shadow-sm group hover:-translate-y-1 hover:border-brand-primary transition-all duration-300 ${
                      !isGridView && "flex flex-col md:flex-row gap-6 p-4"
                    }`}
                  >
                    <div
                      className={`relative overflow-hidden ${
                        isGridView ? "h-48" : "w-full md:w-56 h-40 rounded-2xl shrink-0"
                      }`}
                    >
                      <img
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        src={course.coverImage}
                        alt={course.title}
                        referrerPolicy="no-referrer"
                      />
                      {course.tag && (
                        <div
                          className={`absolute top-4 left-4 px-3 py-1 font-display font-black text-[9px] uppercase tracking-wider rounded-full shadow-sm ${course.tagColor}`}
                        >
                          {course.tag}
                        </div>
                      )}
                    </div>

                    <div className="p-6 flex-1 flex flex-col justify-between">
                      <div className="space-y-3">
                        <div className="flex justify-between items-start gap-2">
                          <h4 className="font-display font-black text-sm text-brand-text leading-tight group-hover:text-brand-primary transition-colors">
                            {course.title}
                          </h4>
                          <button
                            onClick={() => onToggleFavorite(course.id)}
                            className={`p-1.5 hover:bg-brand-error/5 rounded-xl transition-colors shrink-0 ${
                              course.isFavorite ? "text-brand-error" : "text-brand-text-variant/40"
                            }`}
                            title={course.isFavorite ? "Remove Favorite" : "Favorite Course"}
                          >
                            <Heart
                              className={`w-4 h-4 ${course.isFavorite ? "fill-brand-error" : ""}`}
                            />
                          </button>
                        </div>

                        <div className="flex items-center gap-2 select-none">
                          <img
                            className="w-6 h-6 rounded-full ring-1 ring-brand-primary/10 object-cover"
                            src={course.tutorAvatar}
                            alt={course.tutorName}
                            referrerPolicy="no-referrer"
                          />
                          <span className="text-xs font-semibold text-brand-text select-none">
                            {course.tutorName}
                          </span>
                        </div>

                        <div className="flex items-center gap-4 text-brand-text-variant/50 font-display font-extrabold text-[9px] tracking-widest uppercase">
                          <span className="flex items-center gap-1 font-display leading-none">
                            <Clock className="w-3.5 h-3.5 text-brand-text-variant/40" />
                            {course.duration}
                          </span>
                          <span className="flex items-center gap-1 font-display leading-none">
                            <GraduationCap className="w-3.5 h-3.5 text-brand-text-variant/40" />
                            {course.studentCount}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-5 border-t border-brand-border/10 mt-5">
                        <div className="flex items-baseline gap-1">
                          <span className="text-brand-primary font-display font-black text-base">
                            ${course.price}
                          </span>
                          <span className="text-brand-text-variant/50 line-through text-[10px] font-sans">
                            ${course.originalPrice}
                          </span>
                        </div>
                        <button
                          onClick={() =>
                            alert(`Showing curriculum detailing panel for course: ${course.title}`)
                          }
                          className="px-4 py-2 bg-brand-primary text-white hover:bg-brand-primary/95 text-xs font-display font-black tracking-widest rounded-xl transition-all cursor-pointer shadow-sm shadow-brand-primary/10"
                        >
                          Curriculum
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Bottom Bento: Learning paths & Teacher Ad card */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-brand-low/40 p-8 rounded-3xl border border-brand-border/30">
              <h3 className="font-display font-black text-base text-brand-text mb-6">
                Popular Learning Paths
              </h3>
              <div className="space-y-4">
                <div
                  onClick={() => alert("Loading dynamic Data Scientist roadmap...")}
                  className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-brand-border/20 hover:border-brand-primary transition-colors cursor-pointer shadow-sm"
                >
                  <div className="w-12 h-12 bg-brand-primary/10 rounded-xl flex items-center justify-center text-brand-primary">
                    <Code className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-display font-black text-sm text-brand-text">
                      Data Scientist Track
                    </h4>
                    <p className="text-xs font-semibold text-brand-text-variant/60">
                      12 Courses • 8 Months
                    </p>
                  </div>
                </div>

                <div
                  onClick={() => alert("Loading dynamic UI/UX Designer roadmap...")}
                  className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-brand-border/20 hover:border-brand-secondary transition-colors cursor-pointer shadow-sm"
                >
                  <div className="w-12 h-12 bg-brand-secondary/10 rounded-xl flex items-center justify-center text-brand-secondary">
                    <Brush className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-display font-black text-sm text-brand-text">
                      UI/UX Designer Track
                    </h4>
                    <p className="text-xs font-semibold text-brand-text-variant/60">
                      8 Courses • 5 Months
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-brand-low/40 p-8 rounded-3xl border border-brand-border/30 flex flex-col justify-between relative overflow-hidden group">
              <div className="relative z-10 space-y-4">
                <h3 className="font-display font-black text-base text-brand-text">
                  Start Teaching Today
                </h3>
                <p className="text-brand-text-variant text-sm leading-relaxed max-w-sm">
                  Share your knowledge with the world, configure your own curricula, set custom price tags and earn money doing what you love.
                </p>
              </div>
              <div className="pt-6 relative z-10">
                <button
                  onClick={() => alert("Thank you for applying. Register your legal identity details in settings tab!")}
                  className="px-6 py-3 bg-brand-text text-white rounded-2xl text-xs font-display font-black tracking-widest hover:bg-brand-text/95 transition-all shadow-md cursor-pointer"
                >
                  Apply as Tutor
                </button>
              </div>
              <DollarSign className="absolute -right-6 -bottom-6 w-32 h-32 text-brand-text-variant/5 pointer-events-none group-hover:scale-110 group-hover:rotate-12 transition-transform duration-500 shrink-0" />
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
