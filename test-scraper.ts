// Quick test script for FlashScore scraper
import { AFCONMatchFetcher } from './src/infrastructure/sports/AFCONMatchFetcher';

async function testScraper() {
    console.log('========================================');
    console.log('   Testing FlashScore Scraper');
    console.log('========================================\n');

    const fetcher = new AFCONMatchFetcher();

    try {
        const matches = await fetcher.fetchTodayMatches();

        console.log('\n========================================');
        console.log(`✅ SUCCESS: Found ${matches.length} matches`);
        console.log('========================================\n');

        if (matches.length > 0) {
            matches.forEach((match, i) => {
                console.log(`${i + 1}. ${match.homeTeam} vs ${match.awayTeam}`);
                console.log(`   Match ID: ${match.matchId}`);
                console.log(`   Kickoff: ${match.kickoffTime.toISOString()}`);
                console.log('');
            });
        } else {
            console.log('⚠️  No upcoming matches found.');
            console.log('This could mean:');
            console.log('  - No AFCON matches scheduled for next 7 days');
            console.log('  - FlashScore HTML structure changed');
            console.log('  - Network issue\n');
        }

    } catch (error: any) {
        console.log('\n========================================');
        console.log('❌ ERROR');
        console.log('========================================\n');
        console.error(error.message);
        console.error(error.stack);
    }
}

testScraper().then(() => {
    console.log('Test complete!');
    process.exit(0);
}).catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
});
