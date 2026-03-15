import Navbar from '@/components/landing/Navbar'
import Hero from '@/components/landing/Hero'
import Features from '@/components/landing/Features'
import Pricing from '@/components/landing/Pricing'
import DashboardPreview from '@/components/landing/DashboardPreview'
import Footer from '@/components/landing/Footer'

export default function LandingPage() {
  return (
    <main className="relative min-h-screen">
      {/* Animated Star Background */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-[#02040a]" />

        {/* Simple CSS-based stars */}
        <div className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(1px 1px at 20px 30px, #eee, rgba(0,0,0,0)), 
                                 radial-gradient(1px 1px at 40px 70px, #fff, rgba(0,0,0,0)),
                                 radial-gradient(2px 2px at 50px 160px, #ddd, rgba(0,0,0,0)),
                                 radial-gradient(2px 2px at 90px 40px, #fff, rgba(0,0,0,0)),
                                 radial-gradient(1px 1px at 130px 80px, #fff, rgba(0,0,0,0)),
                                 radial-gradient(2px 2px at 160px 120px, #ddd, rgba(0,0,0,0))`,
            backgroundSize: '200px 200px',
            opacity: 0.3
          }}
        />

        {/* Large ambient glows */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-cyan-600/10 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10">
        <Navbar />
        <Hero />
        <Features />
        <Pricing />
        <DashboardPreview />
        <Footer />
      </div>
    </main>
  )
}

